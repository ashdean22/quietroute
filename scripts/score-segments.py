"""
QuietRoute Day 4 — segment scoring + clustering

Reads segments from PostGIS, computes shade distances (SQL),
runs KMeans (k=5) on OSM-tag features, then writes cluster +
independent 0-100 vibe component scores back to the DB.

Proxy labels are intentionally honest:
  low_traffic — highway class proxy (NOT observed traffic counts)
  quiet       — road class + surface softness proxy (NOT sound measurements)
  shaded      — greenspace proximity proxy (NOT canopy cover data)
  lit         — OSM lit tag proxy (NOT measured luminance)
"""

import json
import os
import sys

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    sys.exit('DATABASE_URL not set')

N_CLUSTERS = 5

# ── Vibe score lookup tables ──────────────────────────────────────────────────

# Inverse of vehicle traffic intensity by highway class
# Lower number = more traffic → lower quiet/low_traffic score
_TRAFFIC_LEVEL = {
    'footway': 5,
    'path': 5,
    'cycleway': 8,
    'pedestrian': 5,
    'bridleway': 8,
    'track': 15,
    'living_street': 20,
    'unclassified': 45,
    'residential': 50,
}
_TRAFFIC_DEFAULT = 60  # for service roads, tertiary, etc.

# Surface softness proxy (soft = quieter underfoot)
_SURFACE_SOFTNESS = {
    'grass': 100,
    'dirt': 90,
    'ground': 85,
    'sand': 80,
    'gravel': 60,
    'compacted': 55,
    'paving_stones': 35,
    'concrete': 20,
    'asphalt': 15,
    'metal': 10,
}
_SURFACE_DEFAULT = 50  # unknown surface

# ─────────────────────────────────────────────────────────────────────────────


def compute_shade_distances(cur):
    """Populate shade_dist_m using a PostGIS LATERAL nearest-neighbour join."""
    print('Computing shade_dist_m (LATERAL nearest-neighbour)…')
    cur.execute("""
        UPDATE segments s
        SET shade_dist_m = (
            SELECT ST_Distance(s.geom::geography, g.geom::geography)
            FROM greenspaces g
            ORDER BY s.geom <-> g.geom
            LIMIT 1
        )
        WHERE EXISTS (SELECT 1 FROM greenspaces LIMIT 1)
    """)
    print(f'  Updated {cur.rowcount} segments with shade distances')


def load_segments(cur) -> pd.DataFrame:
    cur.execute("""
        SELECT id, highway, surface, lit, shade_dist_m, length_m, name
        FROM segments
    """)
    rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=['id', 'highway', 'surface', 'lit',
                                     'shade_dist_m', 'length_m', 'name'])
    print(f'Loaded {len(df)} segments')
    return df


def run_clustering(df: pd.DataFrame) -> np.ndarray:
    cat_cols = ['highway', 'surface', 'lit']
    num_cols = ['shade_dist_m', 'length_m']

    # Categorical: fill nulls with 'missing' so OHE preserves the signal
    cat_pipe = Pipeline([
        ('impute', SimpleImputer(strategy='constant', fill_value='missing')),
        ('ohe',    OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
    ])
    # Numeric: median-fill then scale (required — shade_dist_m dominates otherwise)
    num_pipe = Pipeline([
        ('impute', SimpleImputer(strategy='median')),
        ('scale',  StandardScaler()),
    ])

    preprocessor = ColumnTransformer([
        ('cat', cat_pipe, cat_cols),
        ('num', num_pipe, num_cols),
    ])

    X = preprocessor.fit_transform(df[cat_cols + num_cols])
    km = KMeans(n_clusters=N_CLUSTERS, init='k-means++', n_init=10, random_state=42)
    return km.fit_predict(X)


def score_segment(row) -> dict:
    """
    Compute independent 0-100 vibe component scores.
    Each score is a named proxy — see column comments in schema.
    """
    traffic_level = _TRAFFIC_LEVEL.get(row['highway'], _TRAFFIC_DEFAULT)

    # low_traffic: highway class proxy for vehicle traffic intensity
    low_traffic = int(max(0, 100 - traffic_level))

    # quiet: highway class + surface softness (soft surfaces are literally quieter)
    softness = _SURFACE_SOFTNESS.get(row['surface'], _SURFACE_DEFAULT)
    quiet = int(max(0, (low_traffic * 0.7 + softness * 0.3)))

    # shaded: greenspace proximity proxy (0 m → 100, ≥ 500 m → 0, linear)
    dist = row['shade_dist_m'] if pd.notna(row['shade_dist_m']) else 500.0
    shaded = int(max(0, min(100, 100 - dist / 5.0)))

    # lit: OSM lit tag proxy
    lit_val = str(row['lit']).lower() if pd.notna(row['lit']) else ''
    if lit_val == 'yes':
        lit = 100
    elif lit_val in ('no', 'false', '0'):
        lit = 0
    else:
        lit = 50  # unknown — neutral

    return {'low_traffic': low_traffic, 'quiet': quiet, 'shaded': shaded, 'lit': lit}


def write_results(conn, cur, df: pd.DataFrame):
    print('Writing cluster + vibe_score to segments…')
    batch_size = 500
    total = len(df)

    for i in range(0, total, batch_size):
        batch = df.iloc[i:i + batch_size]
        rows = [
            (int(r['id']), int(r['cluster']), json.dumps(score_segment(r)))
            for _, r in batch.iterrows()
        ]
        psycopg2.extras.execute_values(cur, """
            UPDATE segments AS s
            SET cluster = v.cluster::int,
                vibe_score = v.vibe_score::jsonb
            FROM (VALUES %s) AS v(id, cluster, vibe_score)
            WHERE s.id = v.id::bigint
        """, rows)
        pct = min(100, round((i + batch_size) / total * 100))
        print(f'\r  {min(i + batch_size, total)}/{total} ({pct}%)', end='', flush=True)

    conn.commit()
    print()


def print_cluster_summary(df: pd.DataFrame):
    print(f'\n{"─" * 60}')
    print(f'CLUSTER SUMMARY  (k={N_CLUSTERS})')
    print(f'{"─" * 60}')

    for cid in sorted(df['cluster'].unique()):
        sub = df[df['cluster'] == cid]
        highways = sub['highway'].value_counts().head(3).to_dict()
        avg_shade = sub['shade_dist_m'].fillna(500).mean()

        scores = pd.DataFrame([score_segment(r) for _, r in sub.iterrows()])
        avg_scores = scores.mean().round(0).astype(int).to_dict()

        print(f'\nCluster {cid}  —  {len(sub):,} segments')
        print(f'  Highway mix:      {highways}')
        print(f'  Avg shade dist:   {avg_shade:.0f} m')
        print(f'  Avg vibe scores:  {avg_scores}')

        named = sub[sub['name'].notna()][['name', 'highway', 'surface']].head(3)
        if not named.empty:
            print('  Examples:')
            for _, ex in named.iterrows():
                print(f'    · {ex["highway"]}  {ex["name"]}  ({ex["surface"]})')

    print(f'\n{"─" * 60}')


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        compute_shade_distances(cur)
        conn.commit()

        df = load_segments(cur)
        df['cluster'] = run_clustering(df)

        write_results(conn, cur, df)
        print_cluster_summary(df)

    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()
