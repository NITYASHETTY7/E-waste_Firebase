"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

interface AuctionBid {
  id: string;
  auctionId: string;
  vendorId: string;
  amount: number;
  phase: string;
  rank?: number;
  createdAt: string;
  vendor?: { id: string; name: string };
}

interface LeaderboardEntry extends AuctionBid {}

interface UseAuctionSocketOptions {
  auctionId: string;
  enabled?: boolean;
}

export function useAuctionSocket({ auctionId, enabled = true }: UseAuctionSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [auctionState, setAuctionState] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [allBids, setAllBids] = useState<AuctionBid[]>([]);
  const [latestBid, setLatestBid] = useState<AuctionBid | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [extensionCount, setExtensionCount] = useState(0);
  const [bidError, setBidError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [announcedWinnerId, setAnnouncedWinnerId] = useState<string | null>(null);
  const [approvedWinnerId, setApprovedWinnerId] = useState<string | null>(null);

  // Connect to the WebSocket
  useEffect(() => {
    if (!enabled || !auctionId) return;

    console.log(`[Socket] Connecting to ${API_URL}/auction for room ${auctionId}`);
    const socket = io(`${API_URL}/auction`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket] Connected: ${socket.id}`);
      setConnected(true);
      // Join the auction room
      socket.emit('joinAuction', { auctionId });
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err);
      setBidError(`Connection error: ${err.message}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      setConnected(false);
    });

    // Receive full auction state on join
    socket.on('auctionState', (auction: any) => {
      console.log('[Socket] Received auction state:', auction.id);
      setAuctionState(auction);
      if (auction.openPhaseEnd) {
        setEndTime(new Date(auction.openPhaseEnd));
      }
      setExtensionCount(auction.extensionCount || 0);
      // If auction is already completed/ended when we join, mark as ended
      if (auction.status === 'COMPLETED' || auction.status === 'PENDING_SELECTION') {
        setIsEnded(true);
      }
      if (auction.bids) {
        // All bids in chronological order for graph + ledger
        const sorted = [...auction.bids].sort(
          (a: AuctionBid, b: AuctionBid) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setAllBids(sorted);
        // Leaderboard: top bid per vendor sorted by amount desc, then time asc for ties
        const seen = new Set<string>();
        const lb = [...auction.bids]
          .sort((a: AuctionBid, b: AuctionBid) =>
            b.amount !== a.amount
              ? b.amount - a.amount
              : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
          .filter((b: AuctionBid) => {
            if (seen.has(b.vendorId)) return false;
            seen.add(b.vendorId);
            return true;
          });
        setLeaderboard(lb);
      }
    });

    // Receive new bid + updated leaderboard
    socket.on('newBid', (data: { bid: AuctionBid; leaderboard: LeaderboardEntry[] }) => {
      console.log('[Socket] New bid received:', data.bid.amount);
      setLatestBid(data.bid);
      setLeaderboard(data.leaderboard);
      // Append new bid chronologically
      setAllBids(prev => [...prev, data.bid]);
      setBidError(null);
    });

    // Timer extended
    socket.on('timerExtended', (data: { newEndTime: string; extensionCount: number }) => {
      console.log('[Socket] Timer extended to:', data.newEndTime);
      setEndTime(new Date(data.newEndTime));
      setExtensionCount(data.extensionCount);
    });

    // Bid error
    socket.on('bidError', (data: { message: string }) => {
      console.error('[Socket] Bid error:', data.message);
      setBidError(data.message);
      // Clear error after 5 seconds
      setTimeout(() => setBidError(null), 5000);
    });

    // Auction ended by client/admin
    socket.on('auctionEnded', (data: any) => {
      setIsEnded(true);
      if (data?.winnerId) setAnnouncedWinnerId(data.winnerId);
    });

    socket.on('winnerSelected', (data: { vendorId: string }) => {
      setApprovedWinnerId(data.vendorId);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auctionId, enabled]);

  // Countdown timer
  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((endTime.getTime() - now) / 1000));
      setTimeLeft(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  // Place a live bid via WebSocket
  const placeLiveBid = useCallback(
    (vendorId: string, amount: number) => {
      if (!socketRef.current || !connected) {
        setBidError('Not connected to auction server');
        return;
      }
      setBidError(null);
      socketRef.current.emit('placeBid', { auctionId, vendorId, amount });
    },
    [auctionId, connected],
  );

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    connected,
    auctionState,
    leaderboard,
    allBids,
    latestBid,
    endTime,
    extensionCount,
    bidError,
    timeLeft,
    formattedTime: formatTime(timeLeft),
    isActive: timeLeft > 0,
    isEnded,
    placeLiveBid,
    announcedWinnerId,
    approvedWinnerId,
  };
}
