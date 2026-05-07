#!/usr/bin/env python3
"""One-time conversion script: recipes-schema-org.json -> example-recipes.json format"""

import json
import re
from datetime import datetime, timezone


def parse_servings(recipe_yield):
    """Extract numeric serving count from recipeYield string."""
    if not recipe_yield:
        return 0
    match = re.search(r'(\d+)', str(recipe_yield))
    return int(match.group(1)) if match else 0


def convert_ingredient(ingredient_str):
    """Convert schema.org 'Name: amount' strings to app format."""
    if not ingredient_str:
        return ''
    # Most entries look like 'Zwiebeln: 50 g' — strip the colon or leave as-is
    return str(ingredient_str).strip()


def convert_category(categories):
    """Pick the first category or default to 'uncategorized'."""
    if isinstance(categories, list) and len(categories) > 0:
        return str(categories[0])
    return 'uncategorized'


def make_id(index):
    """Generate an ID matching the app pattern."""
    now = datetime.now(timezone.utc)
    ts = int(now.timestamp() * 1000)
    return f"recipe-{ts}-{index:03d}"


def main():
    now_utc = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

    with open('recipes-schema-org.json', 'r', encoding='utf-8') as f:
        source_recipes = json.load(f)

    converted = []
    for idx, src in enumerate(source_recipes, start=1):
        servings = parse_servings(src.get('recipeYield', ''))
        ingredients = src.get('recipeIngredient', []) or []

        notes = []
        if src.get('source'):
            notes.append(f"Source: {src['source']}")
        if src.get('nutrition') and src['nutrition'].get('calories'):
            notes.append(f"Calories: {src['nutrition']['calories']}")

        recipe = {
            "id": make_id(idx),
            "name": src.get('name', 'Untitled Recipe'),
            "category": convert_category(src.get('recipeCategory')),
            "servings": servings,
            "prepTime": 0,                       # not present in source
            "cookTime": 0,                       # not present in source
            "ingredients": ingredients,
            "instructions": [],                  # not present in source
            "notes": notes,
            "createdAt": now_utc,
            "updatedAt": now_utc
        }
        converted.append(recipe)

    output = {
        "recipes": converted,
        "lastUpdated": now_utc
    }

    with open('example-recipes.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Converted {len(converted)} recipes -> example-recipes.json")


if __name__ == '__main__':
    main()
