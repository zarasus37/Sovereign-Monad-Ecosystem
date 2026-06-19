#!/usr/bin/env python3
"""
Base-Arbitrum MEV Monitoring Dashboard
Real-time monitoring for cross-chain arbitrage system

Usage:
    streamlit run dashboard.py

Environment:
    KAFKA_BROKERS: kafka:29092
    LOGS_DIR: /app/logs
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import json
import os
from pathlib import Path

# Config
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
LOGS_DIR = Path(os.getenv("LOGS_DIR", "./logs"))

st.set_page_config(
    page_title="Base-Arbitrum MEV Dashboard",
    page_icon="📈",
    layout="wide"
)

# Title
st.title("🎲 Base-Arbitrum MEV Dashboard")
st.markdown("### Cross-Chain Arbitrage Monitor")

# Sidebar - Controls
st.sidebar.header("Controls")
refresh_rate = st.sidebar.slider("Refresh rate (seconds)", 1, 30, 5)
time_window = st.sidebar.selectbox("Time window", ["1h", "6h", "24h", "7d"], index=1)

# Helper functions
def load_feedback_logs():
    """Load feedback logs from JSONL files"""
    logs = []
    if LOGS_DIR.exists():
        for f in LOGS_DIR.glob("feedback-*.jsonl"):
            with open(f, 'r') as fp:
                for line in fp:
                    try:
                        logs.append(json.loads(line))
                    except:
                        pass
    if not logs:
        return pd.DataFrame()

    df = pd.json_normalize(logs, sep='.')
    if 'timestampMs' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestampMs'], unit='ms', errors='coerce')
    return df


def filter_time_window(df, window):
    """Filter dataframe to the selected time window"""
    if df.empty or 'timestamp' not in df.columns:
        return df

    window_map = {
        '1h': timedelta(hours=1),
        '6h': timedelta(hours=6),
        '24h': timedelta(hours=24),
        '7d': timedelta(days=7),
    }
    cutoff = datetime.now() - window_map[window]
    return df[df['timestamp'] >= cutoff].copy()

def load_kafka_topics():
    """Simulated Kafka topic data (replace with real Kafka consumer)"""
    # In production: use kafka-python or kafkajs to consume live topics
    # This is placeholder data for demo
    return pd.DataFrame()

def process_spread_signals(df):
    """Process spread signals"""
    if df.empty:
        return df
    # Filter to spread signals
    spread_df = df[df.get('eventType', pd.Series()) == 'market.spread.signal'].copy()
    return spread_df

def process_risk_evaluations(df):
    """Process risk evaluations"""
    if df.empty:
        return df
    eval_df = df[df.get('eventType', pd.Series()) == 'risk.opportunity-evaluation'].copy()
    return eval_df

def process_execution_results(df):
    """Process execution results"""
    if df.empty:
        return df
    exec_df = df[df.get('eventType', pd.Series()) == 'execution.execution-result'].copy()
    return exec_df

def process_execution_plans(df):
    """Process execution plans"""
    if df.empty:
        return df
    plans_df = df[df.get('eventType', pd.Series()) == 'execution.execution-plan'].copy()
    return plans_df


def safe_series(df, column, default=0.0):
    """Return a numeric series for the requested column"""
    if column not in df.columns:
        return pd.Series([default] * len(df), index=df.index, dtype='float64')
    return pd.to_numeric(df[column], errors='coerce').fillna(default)


df = filter_time_window(load_feedback_logs(), time_window)
spread_df = process_spread_signals(df)
eval_df = process_risk_evaluations(df)
exec_df = process_execution_results(df)
plan_df = process_execution_plans(df)

approved_df = eval_df[eval_df.get('data.approved', pd.Series(dtype='bool')) == True].copy()
rejected_df = eval_df[eval_df.get('data.approved', pd.Series(dtype='bool')) == False].copy()
success_df = exec_df[exec_df.get('data.success', pd.Series(dtype='bool')) == True].copy()

spread_count = len(spread_df)
approved_count = len(approved_df)
approval_rate = (approved_count / len(eval_df) * 100) if len(eval_df) else 0
execution_count = len(exec_df)
plan_count = len(plan_df)
success_rate = (len(success_df) / execution_count * 100) if execution_count else 0
net_pnl = safe_series(success_df, 'data.realizedPnl').sum()

# Metrics
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("Spreads Detected", spread_count, delta=time_window)

with col2:
    st.metric("Opportunities Approved", approved_count, delta=f"{approval_rate:.1f}% approval")

with col3:
    st.metric("Plans", plan_count, delta=time_window)

with col4:
    st.metric("Executions", execution_count, delta=f"{success_rate:.1f}% success")

# Main dashboard tabs
tab1, tab2, tab3, tab4 = st.tabs(["📊 Spreads", "🎯 Risk Evaluations", "⚡ Executions", "📈 Analysis"])

with tab1:
    st.subheader("Cross-Chain Spread Signals")
    
    # Load and display spread data
    if not df.empty:
        if not spread_df.empty:
            # Time series
            fig = px.line(
                spread_df, 
                x='timestamp', 
                y='data.spreadBps',
                color='data.asset',
                title="Spread Over Time (bps)",
                labels={'data.spreadBps': 'Spread (bps)'}
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # Stats
            st.write("### Spread Statistics")
            col1, col2 = st.columns(2)
            with col1:
                st.write("**Top Spreads**")
                st.dataframe(spread_df.nlargest(10, 'data.spreadBps')[['timestamp', 'data.asset', 'data.spreadBps', 'data.direction']])
            with col2:
                st.write("**Spread Distribution**")
                fig_hist = px.histogram(spread_df, x='data.spreadBps', nbins=50, title="Spread Distribution")
                st.plotly_chart(fig_hist, use_container_width=True)
        else:
            st.info("No spread signals yet. Run the spread-scanner to generate data.")
    else:
        st.info("No data yet. Check Kafka topics or wait for signals.")

with tab2:
    st.subheader("Risk Evaluations")
    
    if not df.empty:
        if not eval_df.empty:
            # EV Distribution
            fig_ev = px.histogram(
                eval_df, 
                x='data.evMean', 
                nbins=50,
                title="EV Distribution",
                labels={'data.evMean': 'Expected Value ($)'}
            )
            st.plotly_chart(fig_ev, use_container_width=True)
            
            # Approved vs Rejected
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Approved", len(approved_df), delta=f"{approval_rate:.1f}%")
            with col2:
                st.metric("Rejected", len(rejected_df))
            
            # Sharpe distribution
            fig_sharpe = px.histogram(
                eval_df,
                x='data.sharpeLike',
                nbins=50,
                title="Sharpe-like Ratio Distribution"
            )
            st.plotly_chart(fig_sharpe, use_container_width=True)
        else:
            st.info("No risk evaluations yet.")
    else:
        st.info("No data yet.")

with tab3:
    st.subheader("Execution Results")
    
    if not df.empty:
        if not exec_df.empty:
            # Success rate
            failed = exec_df[exec_df.get('data.success', pd.Series(dtype='bool')) == False]
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Executions", len(exec_df))
            with col2:
                st.metric("Successful", len(success_df), delta=f"{success_rate:.1f}%")
            with col3:
                total_pnl = safe_series(success_df, 'data.realizedPnl').sum()
                st.metric("Net P&L", f"${total_pnl:.2f}")
            
            # P&L over time
            if 'data.realizedPnl' in exec_df:
                fig_pnl = px.line(
                    success_df,
                    x='timestamp',
                    y='data.realizedPnl',
                    title="P&L Over Time"
                )
                st.plotly_chart(fig_pnl, use_container_width=True)
        else:
            st.info("No executions yet.")
    else:
        st.info("No data yet.")

with tab4:
    st.subheader("Analysis")
    
    # Position heatmap
    st.write("### Portfolio Heatmap")
    st.info("Position concentration will appear here")
    
    # EV vs Risk scatter
    if not df.empty:
        if not eval_df.empty and 'data.evMean' in eval_df.columns:
            scatter_df = eval_df.copy()
            scatter_df['data.size'] = safe_series(scatter_df, 'data.size', 0)
            fig_scatter = px.scatter(
                scatter_df,
                x='data.evMean',
                y='data.evStd',
                color='data.approved',
                size='data.size',
                title="Risk-Return Scatter",
                labels={
                    'data.evMean': 'EV ($)',
                    'data.evStd': 'Std Dev ($)',
                    'data.approved': 'Approved'
                }
            )
            st.plotly_chart(fig_scatter, use_container_width=True)

# Auto-refresh
if refresh_rate > 0:
    import time
    time.sleep(refresh_rate)
    st.rerun()

# Footer
st.markdown("---")
st.caption(f"Base-Arbitrum MEV Dashboard | Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
