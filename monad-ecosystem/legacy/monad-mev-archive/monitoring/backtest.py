#!/usr/bin/env python3
"""
Backtest Module for Monad MEV System
Replay 24h of logs and simulate P&L

Usage:
    python backtest.py --logs-dir ./logs --duration 24h
"""

import argparse
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
import sys

class BacktestEngine:
    def __init__(self, logs_dir: Path, initial_capital: float = 100.0):
        self.logs_dir = logs_dir
        self.initial_capital = initial_capital
        self.current_capital = initial_capital
        self.positions = []
        self.trades = []
        self.spreads = []
        
    def load_data(self):
        """Load all feedback logs"""
        print(f"Loading logs from {self.logs_dir}...")
        
        all_logs = []
        if self.logs_dir.exists():
            for f in self.logs_dir.glob("feedback-*.jsonl"):
                with open(f, 'r') as fp:
                    for line in fp:
                        try:
                            all_logs.append(json.loads(line))
                        except:
                            pass
        
        print(f"Loaded {len(all_logs)} events")
        
        # Categorize by event type
        for log in all_logs:
            event_type = log.get('eventType', '')
            
            if 'spread' in event_type.lower():
                self.spreads.append(log)
            elif 'evaluation' in event_type.lower():
                # Process risk evaluations
                data = log.get('data', {})
                if data.get('approved'):
                    self.trades.append({
                        'timestamp': log.get('timestampMs', 0),
                        'size': float(data.get('size', 0)),
                        'ev': data.get('evMean', 0),
                        'approved': True,
                    })
            elif 'result' in event_type.lower():
                # Process execution results
                data = log.get('data', {})
                self.trades.append({
                    'timestamp': log.get('timestampMs', 0),
                    'size': float(data.get('executedSize', 0)),
                    'pnl': data.get('realizedPnl', 0),
                    'success': data.get('success', False),
                })
        
        print(f"Found {len(self.spreads)} spreads, {len(self.trades)} trades")
        
    def run_backtest(self, 
                     min_spread_bps: float = 5.0,
                     min_ev: float = 10.0,
                     position_limit_pct: float = 0.1,
                     fees_pct: float = 0.001):
        """Run backtest simulation"""
        print(f"\nRunning backtest...")
        print(f"  Min spread: {min_spread_bps} bps")
        print(f"  Min EV: ${min_ev}")
        print(f"  Max position: {position_limit_pct*100}% of capital")
        print(f"  Fees: {fees_pct*100}% per trade")
        
        results = []
        capital = self.initial_capital
        winning_trades = 0
        losing_trades = 0
        
        for spread_log in self.spreads:
            spread_data = spread_log.get('data', {})
            spread_bps = spread_data.get('spreadBps', 0)
            capacity = float(spread_data.get('notionalCapacity', 0))
            
            # Skip if below threshold
            if spread_bps < min_spread_bps:
                continue
            
            # Calculate position size
            max_position = capital * position_limit_pct
            position_size = min(max_position, capacity * 0.1)  # Use 10% of capacity max
            
            if position_size < 10:  # Minimum $10
                continue
            
            # Simulate P&L
            # P&L = position_size * (spread_bps / 10000) - fees
            expected_profit = position_size * (spread_bps / 10000)
            fees = position_size * fees_pct
            net_pnl = expected_profit - fees
            
            # Add some variance (simulate execution uncertainty)
            realized_multiplier = np.random.normal(0.9, 0.2)  # 90% avg fill rate
            realized_pnl = net_pnl * max(0, realized_multiplier)
            
            # Update capital
            capital += realized_pnl
            
            results.append({
                'timestamp': spread_log.get('timestampMs', 0),
                'spread_bps': spread_bps,
                'position_size': position_size,
                'expected_pnl': expected_profit,
                'fees': fees,
                'realized_pnl': realized_pnl,
                'capital_after': capital,
            })
            
            if realized_pnl > 0:
                winning_trades += 1
            else:
                losing_trades += 1
        
        self.results = results
        self.final_capital = capital
        
        return {
            'initial_capital': self.initial_capital,
            'final_capital': capital,
            'total_return_pct': ((capital - self.initial_capital) / self.initial_capital) * 100,
            'total_trades': len(results),
            'winning_trades': winning_trades,
            'losing_trades': losing_trades,
            'win_rate': winning_trades / len(results) * 100 if results else 0,
            'avg_pnl': np.mean([r['realized_pnl'] for r in results]) if results else 0,
        }
    
    def generate_report(self):
        """Generate backtest report"""
        if not hasattr(self, 'results') or not self.results:
            print("No results to report. Run backtest first.")
            return
        
        r = self.results
        
        print("\n" + "="*60)
        print("BACKTEST REPORT")
        print("="*60)
        
        print(f"\n📊 Performance Summary:")
        print(f"  Initial Capital: ${self.initial_capital:.2f}")
        print(f"  Final Capital: ${self.final_capital:.2f}")
        print(f"  Total Return: {((self.final_capital - self.initial_capital) / self.initial_capital) * 100:.2f}%")
        
        print(f"\n📈 Trade Statistics:")
        print(f"  Total Spreads Traded: {len(r)}")
        print(f"  Winning Trades: {sum(1 for x in r if x['realized_pnl'] > 0)}")
        print(f"  Losing Trades: {sum(1 for x in r if x['realized_pnl'] <= 0)}")
        
        if r:
            pnls = [x['realized_pnl'] for x in r]
            print(f"\n💰 P&L:")
            print(f"  Average P&L: ${np.mean(pnls):.2f}")
            print(f"  Max Win: ${max(pnls):.2f}")
            print(f"  Max Loss: ${min(pnls):.2f}")
            print(f"  Total P&L: ${sum(pnls):.2f}")
        
        # Save results to CSV
        df = pd.DataFrame(r)
        output_file = self.logs_dir / "backtest_results.csv"
        df.to_csv(output_file, index=False)
        print(f"\n💾 Results saved to: {output_file}")
        
        print("\n" + "="*60)

def main():
    parser = argparse.ArgumentParser(description='Backtest Monad MEV')
    parser.add_argument('--logs-dir', type=str, default='./logs', help='Logs directory')
    parser.add_argument('--duration', type=str, default='24h', help='Duration to backtest')
    parser.add_argument('--capital', type=float, default=100.0, help='Initial capital')
    parser.add_argument('--min-spread', type=float, default=5.0, help='Min spread (bps)')
    parser.add_argument('--min-ev', type=float, default=10.0, help='Min EV ($)')
    
    args = parser.parse_args()
    
    engine = BacktestEngine(Path(args.logs_dir), args.capital)
    engine.load_data()
    
    if not engine.spreads:
        print("No spread data found. Exiting.")
        sys.exit(1)
    
    results = engine.run_backtest(
        min_spread_bps=args.min_spread,
        min_ev=args.min_ev,
    )
    
    engine.generate_report()
    
    # Print results dict for programmatic use
    print(f"\n📋 Results JSON:")
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()
