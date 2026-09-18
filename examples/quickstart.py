"""Load remittance data into pandas.

    pip install pandas
    python examples/quickstart.py
"""

import os

import pandas as pd

BASE = os.environ.get("REMITTANCES_API_BASE", "https://remittances.mx")


def get(path: str) -> pd.DataFrame:
    """Read any endpoint as a DataFrame via its CSV representation."""
    sep = "&" if "?" in path else "?"
    return pd.read_csv(f"{BASE}{path}{sep}format=csv")


if __name__ == "__main__":
    national = get("/api/v1/national?freq=quarterly")
    national["amount_bn"] = national["amount_usd"] / 1e9
    print("Last 6 quarters received by Mexico:")
    print(national.tail(6)[["period", "amount_bn"]].to_string(index=False))

    states = get("/api/v1/mexico/states?year=2025")
    print("\nTop 5 receiving states in 2025:")
    print(states.head(5)[["state", "amount_usd"]].to_string(index=False))

    us = get("/api/v1/us/states?year=2024")
    us["usd_per_mexican_born"] = us["amount_usd"] / us["mexican_born_population"]
    print("\nHighest sending intensity per Mexican-born resident, 2024:")
    print(
        us.dropna(subset=["usd_per_mexican_born"])
        .nlargest(5, "usd_per_mexican_born")[["state", "usd_per_mexican_born"]]
        .to_string(index=False)
    )
