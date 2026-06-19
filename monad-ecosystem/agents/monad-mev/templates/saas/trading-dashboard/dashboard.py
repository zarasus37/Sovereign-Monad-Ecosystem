import streamlit as st
import pandas as pd
import time

st.set_page_config(page_title="Trading Dashboard", layout="wide")

st.title("📊 Trading Dashboard")

# Sidebar
st.sidebar.header("Configuration")
api_key = st.sidebar.text_input("API Key", type="password")
refresh_rate = st.sidebar.slider("Refresh Rate (seconds)", 1, 60, 5)

# Market Data Section
st.header("Market Data")

col1, col2, col3 = st.columns(3)

with col1:
    st.metric("ETH Price (Base)", "$2,131", "-$12")
with col2:
    st.metric("ETH Price (Arb)", "$2,132", "-$11")
with col3:
    st.metric("Spread", "$1.00", "0.5 bps")

# Price Chart
st.subheader("Price History")
chart_data = pd.DataFrame({
    'Time': pd.date_range(start='now', periods=20, freq='min'),
    'Base': [2131 + i*0.5 for i in range(20)],
    'Arb': [2132 + i*0.5 for i in range(20)],
})
st.line_chart(chart_data.set_index('Time'))

# Positions
st.header("Positions")
positions = pd.DataFrame({
    'Pair': ['ETH/USDC', 'WETH/USDC'],
    'Size': ['1.5 ETH', '0.5 ETH'],
    'Entry': ['$2,130', '$2,128'],
    'Current': ['$2,131', '$2,131'],
    'PnL': ['+$1.50', +'$1.50'],
})
st.table(positions)

# Trades
st.header("Recent Trades")
trades = pd.DataFrame({
    'Time': ['10:32:15', '10:31:42', '10:30:18'],
    'Pair': ['ETH/USDC', 'ETH/USDC', 'ETH/USDC'],
    'Side': ['BUY', 'SELL', 'BUY'],
    'Size': ['0.1 ETH', '0.2 ETH', '0.15 ETH'],
    'Price': ['$2,131', '$2,130', '$2,129'],
})
st.table(trades)

# Auto-refresh
if refresh_rate > 0:
    time.sleep(refresh_rate)
    st.rerun()
