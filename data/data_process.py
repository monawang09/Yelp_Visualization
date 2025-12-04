"""
Utility script to process Yelp dataset JSON-lines files (businesses).

Creates:
- `data/processed/businesses.csv` - cleaned business rows useful for visualization
- `data/processed/states_summary.json` - per-state aggregates (count, avg_stars)
- `data/processed/top_categories.json` - global top categories by business count

Usage:
    python data/data_process.py

The script attempts to locate the business dataset relative to this file, and
writes output into a `processed` subdirectory under `data`.
"""

import os
import json
import csv
import pandas as pd
from collections import defaultdict, Counter
from typing import Dict, Any, Iterable

def load_json_lines(path: str) -> Iterable[Dict[str, Any]]:
    """Yield JSON objects from a JSON-lines file at `path`.

    Supports plain text files where each line is a JSON object.
    """
    with open(path, 'r', encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                # skip malformed lines but continue
                continue


def safe_categories(categories) -> str:
    """Normalize categories value to a semicolon-separated string.

    The `categories` field in Yelp businesses may be None or a string of
    comma-separated categories. We'll return a semicolon-separated string
    (or empty string) to keep CSV fields simple.
    """
    if not categories:
        return ""
    if isinstance(categories, list):
        return ";".join([c.strip() for c in categories if c])
    # assume string
    return ";".join([c.strip() for c in str(categories).split(',') if c.strip()])


def process_business_file(in_path: str, out_dir: str):
    """Process Yelp business JSON-lines file and write CSV + aggregates.

    Parameters:
    - in_path: path to `yelp_academic_dataset_business.json`
    - out_dir: directory where outputs will be written (created if missing)
    """
    os.makedirs(out_dir, exist_ok=True)
    out_csv = os.path.join(out_dir, 'businesses.csv')
    states_counter = Counter()
    states_stars = defaultdict(float)
    states_reviews = defaultdict(int)
    category_counter = Counter()

    fieldnames = [
        'business_id', 'name', 'city', 'state', 'stars', 'review_count',
        'latitude', 'longitude', 'is_open', 'categories','attributes', 'hours'
    ]

    with open(out_csv, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        for obj in load_json_lines(in_path):
            # pick relevant fields with safe defaults
            business_id = obj.get('business_id')
            name = obj.get('name', '')
            city = obj.get('city', '')
            state = obj.get('state', '')
            stars = obj.get('stars', 0.0)
            review_count = obj.get('review_count', 0)
            latitude = obj.get('latitude')
            longitude = obj.get('longitude')
            is_open = obj.get('is_open', 0)
            categories = safe_categories(obj.get('categories'))
            attributes = obj.get('attributes', {})
            hours = obj.get('hours', {})

            writer.writerow({
                'business_id': business_id,
                'name': name,
                'city': city,
                'state': state,
                'stars': stars,
                'review_count': review_count,
                'latitude': latitude,
                'longitude': longitude,
                'is_open': is_open,
                'categories': categories,
                'attributes': attributes,
                'hours': hours 
            })

            # update aggregates
            if state:
                states_counter[state] += 1
                states_stars[state] += float(stars or 0)
                states_reviews[state] += int(review_count or 0)

            if categories:
                # categories is semicolon-separated; break into individual categories
                for c in categories.split(';'):
                    c = c.strip()
                    if c:
                        category_counter[c] += 1

    # write aggregate summaries
    states_summary = {}
    for st, count in states_counter.items():
        avg_stars = states_stars[st] / count if count else 0.0
        total_reviews = states_reviews[st]
        states_summary[st] = {
            'business_count': count,
            'average_stars': round(avg_stars, 3),
            'total_reviews': total_reviews,
        }

    top_categories = category_counter.most_common(200)

    with open(os.path.join(out_dir, 'states_summary.json'), 'w', encoding='utf-8') as fh:
        json.dump(states_summary, fh, indent=2)

    with open(os.path.join(out_dir, 'top_categories.json'), 'w', encoding='utf-8') as fh:
        json.dump([{'category': k, 'count': v} for k, v in top_categories], fh, indent=2)

    return {
        'businesses_csv': out_csv,
        'states_summary': os.path.join(out_dir, 'states_summary.json'),
        'top_categories': os.path.join(out_dir, 'top_categories.json')
    }


def find_business_json_candidate(base_dir: str) -> str:
    """Try to find the Yelp business JSON file under `base_dir`.

    Returns the path if found, else raises FileNotFoundError.
    """
    candidates = [
        os.path.join(base_dir, 'Yelp JSON', 'yelp_dataset', 'yelp_academic_dataset_business.json'),
        os.path.join(base_dir, 'yelp_dataset', 'yelp_academic_dataset_business.json'),
        os.path.join(base_dir, 'yelp_academic_dataset_business.json'),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError('Could not find yelp_academic_dataset_business.json in expected locations.')


def process_raw():
    # dataset layout: this file is in `data/` directory
    data_dir = os.path.dirname(__file__)
    try:
        business_json = find_business_json_candidate(data_dir)
    except FileNotFoundError:
        # try from repository root (parent of data)
        repo_root = os.path.abspath(os.path.join(data_dir, '..'))
        business_json = find_business_json_candidate(repo_root)

    out_dir = os.path.join(data_dir, 'processed')
    results = process_business_file(business_json, out_dir)
    print('Wrote outputs:')
    for k, v in results.items():
        print(f' - {k}: {v}')

def get_data_in_state(processed_csv, state):
    """Utility function to read processed businesses CSV and filter by state.

    Parameters:
    - csv: state code (e.g., 'CA')

    Returns:
    - pandas DataFrame with businesses in the specified state
    """
    
    df = pd.read_csv(processed_csv)
    state_df = df[df['state'] == state]
    print(f'Found {len(state_df)} businesses in state {state}.')
    print(f'state_df columns: {state_df.columns.tolist()}')
    print(f'Found attributes containing "RestaurantsPriceRange2": {state_df["attributes"].str.contains("RestaurantsPriceRange2", na=False).sum()} businesses.') 
    print(f'Found categories containing "Restaurants": {state_df["categories"].str.contains("Restaurants", na=False).sum()} businesses.')
    return state_df

if __name__ == '__main__':
    NEED_UPDTATE = False  # Set to True to reprocess raw data

    data_dir = os.path.dirname(__file__)
    processed_csv = os.path.join(data_dir, 'processed', 'businesses.csv')
    if not os.path.isfile(processed_csv) or NEED_UPDTATE:
        process_raw()
    get_data_in_state(processed_csv, 'CA')
