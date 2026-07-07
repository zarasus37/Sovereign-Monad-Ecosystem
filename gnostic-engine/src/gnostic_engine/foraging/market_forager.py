import requests
import time

MARKET_URL = "https://api.coinbase.com/v2/prices/BTC-USD/spot"
# Layer 7.7: migrated to the typed /api/v1/gnosis/process endpoint.
SGE_URL = "http://127.0.0.1:8001/api/v1/gnosis/process"

def forage_market_truth():
    print("--- SGE Market Forager Active (Public Data) ---")
    last_price = None
    while True:
        try:
            raw_data = requests.get(MARKET_URL).json()
            price = float(raw_data['data']['amount'])

            if last_price is None:
                last_price = price

            payload = {
                "agent_id": "MARKET_VOLATILITY_BTC",
                "lane_a": price / 70000,   # current price
                "lane_b": last_price / 70000,  # simple bedrock
                "lane_c": 0.02,
                "v_mask": [],
                "w_cong": True,
                "w_host_ratio": None,
                "w_user_ratio": None,
            }

            res = requests.post(SGE_URL, json=payload).json()
            print(f"Price: ${price} | SR: {res['overall_score']} | Verdict: {res['verdict']}")

            last_price = price

        except Exception as e:
            print(f"Forage Error: {e}")

        time.sleep(10)

if __name__ == "__main__":
    forage_market_truth()