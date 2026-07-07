import streamlit as st
import requests
import pandas as pd
import time

st.set_page_config(page_title="SGE Visual Interface", layout="wide")
st.title("Gnostic Engine: Volumetric Monitor")

# Sidebar for controls
st.sidebar.header("Intake Controls")
var_id = st.sidebar.text_input("Variable ID", "V4_SILENT_UPDATE")
l_a = st.sidebar.slider("Lane A (Discovery)", 0.0, 1.0, 0.95)
l_b = st.sidebar.slider("Lane B (Verification)", 0.0, 1.0, 0.92)
l_c = st.sidebar.slider("Lane C (Width)", 0.0, 1.0, 0.10)

if st.sidebar.button("Run Diagnostic"):
    # Layer 7.7: typed /api/v1/gnosis/process (agent_id, overall_score).
    payload: dict[str, object] = {
        "agent_id": var_id,
        "lane_a": l_a,
        "lane_b": l_b,
        "lane_c": l_c,
        "v_mask": [True, True, True, True],
        "w_cong": True,
    }
    try:
        res = requests.post(
            "http://127.0.0.1:8001/api/v1/gnosis/process", json=payload
        ).json()

        col1, col2, col3 = st.columns(3)
        col1.metric("Verdict", res['verdict'])
        col2.metric("Structural Read", res['overall_score'])
        col3.metric("Phase Tilt", f"{res.get('parallax', {}).get('tilt_magnitude', 0.0)}°")

        if res['verdict'] == "FOCAL_LOCK":
            st.success("Durable Truth Established.")
        else:
            st.error("Phase Slip Detected: Rejecting State.")

    except Exception as e:
        st.error(f"Could not connect to API. Is the server running? {e}")
