/**
 * FundingStatusPanel - Real-time Cardia Funding Status Display
 * 
 * Displays the live funding status with audit trace (X-AUDITABILITY).
 * Uses the terminal aesthetic from the Onboarding Arc.
 */

import React from 'react';
import {
  useFundingStatus,
  getFundingStatusLabel,
  getFundingStatusColor,
} from '@/hooks/useFundingStatus';
import { useShaliahOnboarding } from '@/hooks/useShaliahOnboarding';

/**
 * Format a wallet address for display.
 */
function formatAddress(address: string | null): string {
  if (!address) return '—';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format a txHash for display.
 */
function formatTxHash(hash: string | undefined): string {
  if (!hash) return '—';
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * FundingStatusPanel component.
 * 
 * Displays real-time funding status from the Cardia engine.
 * Shows audit trace for X-AUDITABILITY compliance.
 */
export const FundingStatusPanel: React.FC = () => {
  const boundWallet = useShaliahOnboarding((s) => s.boundWallet);
  const isBound = Boolean(boundWallet);
  const { status, isConnected, fundingStatus, isFunding, error } =
    useFundingStatus(boundWallet);

  const statusLabel = getFundingStatusLabel(fundingStatus);
  const statusColor = getFundingStatusColor(fundingStatus);

  return (
    <div className="border border-gray-800 bg-gray-950 rounded-lg font-mono text-sm overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <svg 
            className="w-4 h-4 text-cyan-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <h3 className="text-xs uppercase tracking-widest text-gray-400">
            Cardia Funding Engine
          </h3>
        </div>
        
        {/* Connection status */}
        <div className={`flex items-center gap-2 text-xs ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          {isConnected ? 'STREAM LIVE' : 'OFFLINE'}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {!isBound ? (
          // Not bound state
          <div className="text-center py-8 text-gray-600">
            <svg 
              className="w-8 h-8 mx-auto mb-3 text-gray-700" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
            <p className="text-xs uppercase tracking-wider">Wallet Not Bound</p>
            <p className="text-xs text-gray-600 mt-1">Complete Onboarding Arc to enable funding.</p>
          </div>
        ) : (
          // Funding content
          <div className="space-y-3">
            {/* Principal wallet */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Principal</span>
              <span className="text-white text-sm">{formatAddress(boundWallet)}</span>
            </div>

            {/* Status */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Status</span>
              <span className={`font-bold ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            {/* Amount (if funded) */}
            {status?.amount !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Amount</span>
                <span className="text-white">
                  ${status.amount.toLocaleString()}
                </span>
              </div>
            )}

            {/* Transaction hash */}
            {status?.txHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Tx Hash</span>
                <a
                  href={`https://monad-testnet.blockscout.com/tx/${status.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline text-sm"
                >
                  {formatTxHash(status.txHash)}
                </a>
              </div>
            )}

            {/* Audit Trace - X-AUDITABILITY */}
            {status?.auditTrace && status.auditTrace.length > 0 && (
              <div className="pt-3 border-t border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg 
                    className="w-3 h-3 text-gray-600" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
                    />
                  </svg>
                  <p className="text-xs text-gray-600 uppercase tracking-wider">Audit Trace</p>
                </div>
                
                <div className="space-y-1 text-xs text-gray-500 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                  {status.auditTrace.map((trace, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-gray-700 mt-0.5">├─</span>
                      <span className="break-all">{trace}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="pt-3 border-t border-gray-800">
                <div className="flex items-center gap-2 text-red-400 text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            {/* Synthesized indicator (dev mode) */}
            {status?.synthesized && (
              <div className="pt-2 border-t border-gray-800">
                <div className="flex items-center gap-2 text-xs text-yellow-600">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  DRY RUN — No actual transaction
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FundingStatusPanel;