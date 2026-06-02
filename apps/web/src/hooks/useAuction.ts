"use client";

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Listing, Bid } from '@/types';
import { useAuctionSocket } from './useAuctionSocket';

export function useAuction(listingId: string, options: { forceConnect?: boolean } = {}) {
  const { listings, bids, addBid, editListing, currentUser, addNotification } = useApp();
  const listing = listings.find(l => l.id === listingId || l.auctionId === listingId);
  const auctionBids = bids.filter(b =>
    b.listingId === listingId ||
    (listing?.auctionId && b.auctionId === listing.auctionId) ||
    b.auctionId === listingId
  ).sort((a, b) => b.amount - a.amount);
  const currentHighBid = auctionBids[0];
  const currentHighAmount = currentHighBid?.amount || listing?.basePrice || 0;

  // Use WebSocket for live auctions
  const isLive = options.forceConnect || listing?.auctionPhase === 'live';
  const socket = useAuctionSocket({
    auctionId: listing?.auctionId || listingId,
    enabled: isLive,
  });

  const [localTimeLeft, setLocalTimeLeft] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);

  // Effective end time: listing.auctionEndDate is authoritative; only accept socket.endTime
  // if it is LATER (i.e. a timer extension fired after the listing was last fetched)
  const listingEndMs = listing?.auctionEndDate ? new Date(listing.auctionEndDate).getTime() : 0;
  const socketEndMs = socket.endTime?.getTime() ?? 0;
  const effectiveEndMs = socketEndMs > listingEndMs ? socketEndMs : listingEndMs;

  const isAuctionCompleted = socket.auctionState?.status === 'COMPLETED' || socket.auctionState?.status === 'PENDING_SELECTION';

  useEffect(() => {
    if (!isLive || !effectiveEndMs || socket.isEnded || isAuctionCompleted) {
      setIsActive(false);
      setLocalTimeLeft(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((effectiveEndMs - Date.now()) / 1000));
      setLocalTimeLeft(diff);
      setIsActive(diff > 0);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isLive, effectiveEndMs, socket.isEnded, isAuctionCompleted]);

  const timeLeft = localTimeLeft;

  const placeBid = useCallback(async (amount: number) => {
    if (!listing || !currentUser) return { success: false, message: 'Not logged in' };

    if (isLive && socket.connected) {
      // Use WebSocket for live bidding — real-time!
      socket.placeLiveBid(currentUser.id, amount);
      return { success: true };
    }

    // Fallback: sealed bid via REST API
    const minNextBid = currentHighAmount + (listing.bidIncrement || 0);
    if (amount < minNextBid) {
      return { success: false, message: `Minimum bid is ₹${minNextBid.toLocaleString()}` };
    }

    try {
      await addBid(listing.id, amount);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e?.message || 'Failed to place bid' };
    }
  }, [listing, currentUser, currentHighAmount, addBid, isLive, socket]);

  const formatTimeStr = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // All bids in chronological order for graph + ledger
  // Prefer socket data ONLY if it's connected and has data; otherwise fallback to context
  const effectiveAllBids = (isLive && socket.connected && socket.allBids.length > 0)
    ? socket.allBids
    : [...auctionBids].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Top bid per vendor for leaderboard / current high
  const effectiveLeaderboard = (isLive && socket.connected && socket.leaderboard.length > 0)
    ? socket.leaderboard
    : auctionBids;

  return {
    listing,
    auctionBids: effectiveAllBids,
    leaderboard: effectiveLeaderboard,
    currentHighAmount: isLive && socket.connected && socket.leaderboard[0]
      ? socket.leaderboard[0].amount
      : currentHighAmount,
    currentHighBid,
    timeLeft,
    formatTime: formatTimeStr(localTimeLeft),
    isActive,
    placeBid,
    // Real-time extras
    isConnected: socket.connected,
    extensionCount: socket.extensionCount,
    bidError: socket.bidError,
    latestBid: socket.latestBid,
    announcedWinnerId: socket.announcedWinnerId,
    approvedWinnerId: socket.approvedWinnerId,
  };
}
