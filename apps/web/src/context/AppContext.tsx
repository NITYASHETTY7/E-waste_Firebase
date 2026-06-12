"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Listing, Bid, AppState, UserRole, Notification, OnboardingProfile, BankDetails, UploadedDoc, AuditInvitation, VendorRating } from '@/types';
import api from '@/lib/api';
import axios from 'axios';

interface AppContextType extends AppState {
  refreshData: () => Promise<void>;
  login: (role: UserRole, email: string, password?: string) => Promise<void>;
  logout: () => void;
  register: (role: UserRole, name: string, email: string, password?: string, phone?: string) => Promise<{ devEmailOtp?: string; devPhoneOtp?: string; resumed?: boolean; resumeStep?: number }>;
  startOnboarding: (role: 'client' | 'vendor' | 'consumer', email: string, password: string) => void;
  saveOnboardingProfile: (profile: OnboardingProfile) => Promise<void>;
  saveOnboardingDocuments: (docs: UploadedDoc[]) => Promise<void>;
  saveOnboardingBankDetails: (bank: BankDetails, chequeFile?: File) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  addListing: (listing: Omit<Listing, 'id' | 'createdAt' | 'status'>) => void;
  addBid: (listingId: string, amount: number, remarks?: string) => Promise<void>;
  updateListingStatus: (id: string, status: Listing['status'], reason?: string) => Promise<void>;
  updateAuctionPhase: (id: string, phase: Listing['auctionPhase']) => Promise<void>;
  updateBidStatus: (id: string, status: Bid['status'], reason?: string) => void;
  updateUserStatus: (id: string, status: User['status'], reason?: string) => Promise<void>;
  assignVendor: (listingId: string, vendorId: string) => void;
  acceptBid: (bidId: string) => void;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  editListing: (id: string, updates: Partial<Listing>) => void;
  editBid: (id: string, updates: Partial<Bid>) => void;
  respondToInvitation: (invitationId: string, status: 'ACCEPTED' | 'REJECTED') => Promise<void>;
  transitionAuctionPhase: (listingId: string, nextPhase: Listing['auctionPhase']) => Promise<void>;
  addClosingDocument: (listingId: string, doc: { name: string; url: string; type: string; timestamp: string }) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  // Audit flow
  auditInvitations: AuditInvitation[];
  sendAuditInvitations: (listingId: string, vendorIds: string[], spocName: string, spocPhone: string, siteAddress: string) => void;
  respondToAuditInvitation: (auditId: string, status: 'accepted' | 'declined') => void;
  completeAudit: (auditId: string, productMatch: boolean, remarks: string) => void;
  // Requirement sheet flow
  uploadProcessedSheet: (listingId: string, file: File, vendorIds?: string[]) => Promise<void>;
  approveRequirement: (listingId: string, targetPrice: number, totalWeight?: number) => Promise<void>;
  // Step 6 — Purchase Order
  issuePO: (listingId: string, data: { paymentTerms: string; deliveryTerms: string; penaltyClause: string; specialConditions: string }) => void;
  acknowledgePO: (listingId: string) => void;
  // Step 6 — EMD
  submitEMD: (listingId: string, amount: number, utr: string) => Promise<void>;
  verifyEMD: (listingId: string) => void;
  // Payment flow
  submitPaymentProof: (listingId: string, file: File, utrNumber: string) => Promise<void>;
  confirmPayment: (listingId: string) => void;
  // Step 7 — Handover Documents
  createHandoverDocs: (listingId: string, data: { gatePass: string; vehicle: string; driver: string; date: string; notes: string }) => void;
  acknowledgeHandover: (listingId: string) => void;
  // Step 8 — Reconciliation
  submitReconciliation: (listingId: string, finalWeight: number, finalQuantity: number, finalValue: number, notes: string, file?: File) => Promise<void>;
  verifyReconciliation: (listingId: string) => void;
  // Compliance flow
  submitComplianceDocs: (listingId: string, files: Record<string, File | null>, pickupDate?: string) => Promise<void>;
  verifyCompliance: (listingId: string) => void;
  // Rating flow
  vendorRatings: VendorRating[];
  rateVendor: (listingId: string, vendorId: string, vendorName: string, rating: number, auditR: number, timelinessR: number, complianceR: number, comment: string) => void;
  changePassword: (newPassword: string) => void;
  deleteAccount: () => Promise<void>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isInitialized: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'weconnect_state_v13';

const MOCK_LISTINGS: Listing[] = [
  {
    id: 'ECO18951', title: 'Batch of CRT Monitors and Mixed eWaste (15 Units)', category: 'Display Units', subCategory: 'ITAssets',
    weight: 1500, location: 'Bengaluru Global Village', locationType: 'STPI', status: 'active', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'End of life IT hardware including legacy CRT monitors, thick-client workstations, and broken peripherals.',
    createdAt: '2026-04-10T10:00:00.000Z', urgency: 'medium', bidCount: 4, viewCount: 124,
    auctionStartDate: '2026-04-16T08:00:00.000Z',
    auctionEndDate: '2026-04-17T18:00:00.000Z',
    auctionPhase: 'live', basePrice: 21000, bidIncrement: 500, highestEmdAmount: 5000,
    images: ['https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18950', title: 'Decommissioned Server Rack Components', category: 'IT Equipment', subCategory: 'DataCenter Assets',
    weight: 4200, location: 'Bengaluru Whitefield (STPI)', locationType: 'SEZ / STPI', status: 'active', userId: 'C2',
    userName: 'Global Infra Pvt Ltd', description: 'Includes storage drives (drilled), network switches, and redundant power supplies. Vendor must possess Category 1 handling certification.',
    createdAt: '2026-04-14T14:30:00.000Z', urgency: 'high', bidCount: 2, viewCount: 89,
    auctionPhase: 'sealed_bid', basePrice: 135000, highestEmdAmount: 25000,
    images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18937', title: 'Lithium Battery Storage Cell Block', category: 'Batteries', subCategory: 'UPS Systems',
    weight: 850, location: 'Harman International-Bangalore', locationType: 'Corporate Park', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Used backup laptop battery matrices and UPS cell columns. 240 units total. Partially functional.',
    createdAt: '2026-04-01T09:15:00.000Z', urgency: 'low', bidCount: 8, viewCount: 210,
    auctionPhase: 'completed', basePrice: 42000, bidIncrement: 2000, highestEmdAmount: 10000,
    images: ['https://images.unsplash.com/photo-1563298723-dcfebaa392e3?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18910', title: 'Legacy Workstations (Pentium Era)', category: 'Laptops & PCs',
    weight: 2200, location: 'Whitefield, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Bulk removal of 85 legacy tower PCs. Very old hardware, intended for scrap value only.',
    createdAt: '2026-03-15T11:00:00.000Z', urgency: 'low', bidCount: 5, viewCount: 145,
    auctionPhase: 'completed', basePrice: 15000, bidIncrement: 1000,
    images: ['https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18905', title: 'Redundant Power Distribution Units', category: 'Power Equipment',
    weight: 950, location: 'Hydrabad, HITEC City', status: 'completed', userId: 'C2',
    userName: 'Global Infra Pvt Ltd', description: 'Heavy duty rack-mount PDUs. Industrial grade copper content.',
    createdAt: '2026-03-01T16:45:00.000Z', urgency: 'medium', bidCount: 7, viewCount: 92,
    auctionPhase: 'completed', basePrice: 65000, bidIncrement: 2500,
    images: ['https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18960', title: 'Mixed Office IT Scrap (Laptops & Peripherals)', category: 'Laptops & PCs',
    weight: 450, location: 'Electronic City, Bangalore', status: 'active', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Assorted lot of 25 Dell laptops (Latitude series), 15 HP keyboards, and 10 Logitech mice. Non-functional.',
    createdAt: '2026-04-15T12:00:00.000Z', urgency: 'medium', bidCount: 0, viewCount: 15,
    auctionPhase: 'sealed_bid', basePrice: 85000, highestEmdAmount: 15000,
    images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18972', title: 'Industrial Copper Wiring and Connectors', category: 'Cables & Wiring',
    weight: 3200, location: 'Peenya Industrial Area', status: 'active', userId: 'C3',
    userName: 'Manufacturing Hub', description: 'Stripped copper wiring from decommissioned production line. High-grade industrial quality.',
    createdAt: '2026-04-12T08:00:00.000Z', urgency: 'low', bidCount: 5, viewCount: 78,
    auctionPhase: 'live',
    auctionStartDate: '2026-04-16T10:00:00.000Z',
    auctionEndDate: '2026-04-18T10:00:00.000Z',
    basePrice: 450000, bidIncrement: 5000, highestEmdAmount: 50000,
    images: ['https://images.unsplash.com/photo-1558494949-ef010cbdcc48?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18980', title: 'Legacy Telecom Equipment (Base Stations)', category: 'Other',
    weight: 8500, location: 'Manesar, Haryana', status: 'active', userId: 'C2',
    userName: 'Global Infra Pvt Ltd', description: 'Decommissioned 2G/3G base station hardware. Heavy metal enclosures. Mixed PCB content.',
    createdAt: '2026-04-06T14:00:00.000Z', urgency: 'low', bidCount: 12, viewCount: 156,
    auctionPhase: 'completed', basePrice: 1200000, bidIncrement: 10000,
    images: ['https://images.unsplash.com/photo-1516397281156-ca07cf9746fc?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18985', title: 'Batch of 100+ Smartphones (Mixed Brands)', category: 'Mobile Devices',
    weight: 25, location: 'Gurgaon, Sector 44', status: 'active', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Mixed lot of corporate smartphones (iPhone, Samsung, Pixel). Screen damage or battery issues in 80% units.',
    createdAt: '2026-04-16T12:00:00.000Z', urgency: 'high', bidCount: 3, viewCount: 45,
    auctionPhase: 'sealed_bid', basePrice: 250000, highestEmdAmount: 30000,
    images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80']
  },

  {
    id: 'CON-L1', title: 'Old Sony Bravia 42 inch LED TV', category: 'Display Units', subCategory: 'Consumer Electronics',
    weight: 15, location: 'Koramangala, Bangalore', status: 'completed', userId: 'CON1',
    userName: 'Rahul Sharma', description: 'Used LED TV with screen flickering issues. Original stand included.',
    createdAt: '2026-04-12T10:00:00.000Z', urgency: 'medium', bidCount: 3, viewCount: 45,
    auctionPhase: 'completed', basePrice: 800, bidIncrement: 100,
    images: ['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'CON-L2', title: 'Mixed Home Electronics (Blender, Iron, Toaster)', category: 'Home Appliances', subCategory: 'Small Appliances',
    weight: 12, location: 'Koramangala, Bangalore', status: 'active', userId: 'CON1',
    userName: 'Rahul Sharma', description: 'Assorted non-functional home appliances. Toaster heating element broken, blender motor burnt.',
    createdAt: '2026-04-17T09:00:00.000Z', urgency: 'low', bidCount: 1, viewCount: 22,
    auctionPhase: 'sealed_bid', basePrice: 400, highestEmdAmount: 50,
    images: ['https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'ECO18990', title: 'Bulk Desktop Computers (Office Decommission Lot)', category: 'Laptops & PCs',
    weight: 800, location: 'MG Road, Bangalore', status: 'active', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Bulk lot of 40 desktop computers from office decommission. Core i3/Pentium era hardware. HDD securely wiped. Non-functional screens excluded.',
    createdAt: '2026-04-19T09:00:00.000Z', urgency: 'medium', bidCount: 0, viewCount: 8,
    auctionPhase: 'invitation_window',
    invitedVendorIds: ['V1', 'V2', 'V3'],
    vendorResponses: [
      { vendorId: 'V1', status: 'interested', respondedAt: '2026-04-19T11:00:00.000Z' },
      { vendorId: 'V2', status: 'declined', respondedAt: '2026-04-19T10:30:00.000Z' },
    ],
    sealedBidStartDate: '2026-04-20T14:00:00.000Z',
    sealedBidEndDate: '2026-04-20T17:00:00.000Z',
    invitationDeadline: '2026-04-21T18:00:00.000Z',
    images: ['https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=800&q=80']
  },

  // ── POST-AUCTION DEMO LISTINGS ──────────────────────────────────────────
  // Stage 1: Auction done, vendor submitted final quote → client must approve
  {
    id: 'ECO18992', title: 'Network Switches & Patch Panels (EOL Batch)', category: 'IT Equipment',
    weight: 620, location: 'Koramangala, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'End-of-life Cisco Catalyst switches and 48-port patch panels. 28 units total. Factory reset. Suitable for copper/PCB recovery.',
    createdAt: '2026-04-10T11:00:00.000Z', urgency: 'medium', bidCount: 5, viewCount: 98,
    auctionPhase: 'completed', basePrice: 95000, bidIncrement: 2000, highestEmdAmount: 12000,
    auctionStartDate: '2026-04-17T10:00:00.000Z', auctionEndDate: '2026-04-18T18:00:00.000Z',
    winnerVendorId: 'V1', winnerVendorName: 'Green Recyclers Pvt Ltd',
    finalQuoteStatus: 'submitted',
    finalQuoteProductUrl: undefined,
    finalQuoteLetterheadUrl: undefined,
    finalQuoteSubmittedAt: '2026-04-20T14:30:00.000Z',
    images: ['https://images.unsplash.com/photo-1558494949-ef010cbdcc48?auto=format&fit=crop&w=800&q=80']
  },

  // Stage 2: Final quote approved, payment proof uploaded → admin to confirm
  {
    id: 'ECO18993', title: 'UPS Battery Banks (Industrial Grade)', category: 'Batteries',
    weight: 1850, location: 'Electronic City, Bangalore', status: 'completed', userId: 'C2',
    userName: 'Global Infra Pvt Ltd', description: 'Industrial UPS battery banks (12V/100Ah VRLA blocks). 96 units. Capacity degraded below 60%. Lead content high — needs authorised recycler.',
    createdAt: '2026-04-05T08:00:00.000Z', urgency: 'high', bidCount: 9, viewCount: 178,
    auctionPhase: 'completed', basePrice: 220000, bidIncrement: 5000, highestEmdAmount: 30000,
    auctionStartDate: '2026-04-14T09:00:00.000Z', auctionEndDate: '2026-04-15T18:00:00.000Z',
    winnerVendorId: 'V3', winnerVendorName: 'RecycleFirst India',
    finalQuoteStatus: 'approved',
    finalQuoteSubmittedAt: '2026-04-17T10:00:00.000Z',
    paymentStatus: 'proof_uploaded',
    paymentClientAmount: 237500, paymentCommissionAmount: 12500,
    paymentUTR: 'ICIC2604190082345', paymentSubmittedAt: '2026-04-19T16:45:00.000Z',
    images: ['https://images.unsplash.com/photo-1563298723-dcfebaa392e3?auto=format&fit=crop&w=800&q=80']
  },

  // ── STEP 6: PO issued, vendor must acknowledge ────────────────────────────
  {
    id: 'ECO19001', title: 'Server Room IT Assets — Phase 1 Decommission', category: 'IT Equipment',
    weight: 1200, location: 'Koramangala, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'HP ProLiant servers (Gen 9/10), Dell PowerEdge R740 units. 18 servers total. HDDs removed. BIOS reset. Includes rack hardware and PDUs.',
    createdAt: '2026-04-22T09:00:00.000Z', urgency: 'high', bidCount: 5, viewCount: 88,
    auctionPhase: 'completed', basePrice: 160000, bidIncrement: 3000, highestEmdAmount: 20000,
    winnerVendorId: 'V1', winnerVendorName: 'Green Recyclers Pvt Ltd',
    finalQuoteStatus: 'approved', finalQuoteSubmittedAt: '2026-04-25T11:00:00.000Z',
    poStatus: 'issued',
    poNumber: 'WC-2026-0047',
    poIssuedAt: '2026-04-26T10:00:00.000Z',
    poPaymentTerms: 'Advance Payment — 100% before pickup',
    poDeliveryTerms: 'Ex-Works (Client premises, Koramangala)',
    poPenaltyClause: '2% per week of delay, capped at 10%',
    poSpecialConditions: 'All drives to be physically destroyed on-site. Vendor must carry CPCB certificate.',
    emdStatus: 'pending', emdAmount: 20000,
    images: ['https://images.unsplash.com/photo-1558494949-ef010cbdcc48?auto=format&fit=crop&w=800&q=80']
  },

  // ── STEP 6: PO acknowledged, EMD pending → then payment ──────────────────
  {
    id: 'ECO19002', title: 'Network Equipment Lot — End of Lease Return', category: 'IT Equipment',
    weight: 560, location: 'MG Road, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Cisco Catalyst 9000 series switches (12 units), Juniper SRX firewalls (4 units), Aruba access points (32 units). All factory-reset.',
    createdAt: '2026-04-18T10:00:00.000Z', urgency: 'medium', bidCount: 4, viewCount: 63,
    auctionPhase: 'completed', basePrice: 120000, bidIncrement: 2000, highestEmdAmount: 15000,
    winnerVendorId: 'V1', winnerVendorName: 'Green Recyclers Pvt Ltd',
    finalQuoteStatus: 'approved', finalQuoteSubmittedAt: '2026-04-21T14:00:00.000Z',
    poStatus: 'acknowledged', poNumber: 'WC-2026-0046', poIssuedAt: '2026-04-22T09:00:00.000Z',
    poPaymentTerms: 'Net 15 — Payment within 15 days of PO acknowledgement',
    poDeliveryTerms: 'Ex-Works (Client premises, MG Road)',
    poPenaltyClause: '1.5% per week of delay, capped at 8%',
    emdStatus: 'submitted', emdAmount: 15000, emdUTR: 'HDFC2604220099123', emdSubmittedAt: '2026-04-23T10:00:00.000Z',
    paymentStatus: 'pending', paymentClientAmount: 142500, paymentCommissionAmount: 7500,
    images: ['https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&w=800&q=80']
  },

  // V1 payment pending — client just approved quote, vendor must pay (payment flow demo)
  {
    id: 'ECO18996', title: 'Workstation PC Lot (Engineering Dept Refresh)', category: 'Laptops & PCs',
    weight: 940, location: 'Indiranagar, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Dell Precision workstations (Gen 7-9). 22 units. Drives wiped. BIOS locked. Hard drives removed and shredded.',
    createdAt: '2026-04-08T11:00:00.000Z', urgency: 'medium', bidCount: 4, viewCount: 71,
    auctionPhase: 'completed', basePrice: 80000, bidIncrement: 2000, highestEmdAmount: 10000,
    winnerVendorId: 'V1', winnerVendorName: 'Green Recyclers Pvt Ltd',
    finalQuoteStatus: 'approved', finalQuoteSubmittedAt: '2026-04-19T09:00:00.000Z',
    poStatus: 'acknowledged', poNumber: 'WC-2026-0044', poIssuedAt: '2026-04-18T09:00:00.000Z',
    poPaymentTerms: 'Advance Payment — 100% before pickup', poDeliveryTerms: 'Ex-Works (Client premises)',
    emdStatus: 'verified', emdAmount: 10000, emdUTR: 'ICIC2604170055678',
    paymentStatus: 'pending', paymentClientAmount: 109750, paymentCommissionAmount: 5750,
    images: ['https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=800&q=80']
  },

  // ── STEP 7: Payment confirmed, client has sent handover docs → vendor to acknowledge ──
  {
    id: 'ECO18997', title: 'Mixed PCB Scrap — R&D Lab Decommission', category: 'Circuit Boards',
    weight: 380, location: 'HSR Layout, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'PCBs from decommissioned R&D lab equipment. Includes motherboards, daughter cards, and memory modules. Lead-solder boards included.',
    createdAt: '2026-04-02T10:00:00.000Z', urgency: 'low', bidCount: 3, viewCount: 55,
    auctionPhase: 'completed', basePrice: 55000, bidIncrement: 1000,
    winnerVendorId: 'V1', winnerVendorName: 'Green Recyclers Pvt Ltd',
    finalQuoteStatus: 'approved',
    poStatus: 'acknowledged', poNumber: 'WC-2026-0042', poIssuedAt: '2026-04-09T09:00:00.000Z',
    poPaymentTerms: 'Advance Payment', poDeliveryTerms: 'Ex-Works', emdStatus: 'not_required',
    paymentStatus: 'confirmed', paymentClientAmount: 68400, paymentCommissionAmount: 3600, paymentUTR: 'ICIC2604080033221',
    handoverStatus: 'created',
    handoverGatePass: 'GP-2026-0312', handoverVehicle: 'KA-01-AB-5678', handoverDriver: 'Ramesh Kumar',
    handoverDate: '2026-05-10T09:00:00.000Z', handoverNotes: 'Report to Gate 3. Contact security: Ravi +91 98001 11222. PCB lots in Warehouse B, Rack 14-18.',
    images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80']
  },

  // ── STEP 8: Handover done, reconciliation submitted → admin to verify ────
  {
    id: 'ECO18994', title: 'Decommissioned Data Centre Cooling Units', category: 'Other',
    weight: 3400, location: 'Whitefield, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'Precision air conditioning units from decommissioned DC. Compressors removed. Aluminium fins, copper coils, and steel enclosures.',
    createdAt: '2026-03-28T09:00:00.000Z', urgency: 'low', bidCount: 6, viewCount: 133,
    auctionPhase: 'completed', basePrice: 180000, bidIncrement: 4000, highestEmdAmount: 25000,
    winnerVendorId: 'V2', winnerVendorName: 'EcoMetal Solutions',
    finalQuoteStatus: 'approved',
    poStatus: 'acknowledged', poNumber: 'WC-2026-0038', poIssuedAt: '2026-03-31T09:00:00.000Z',
    emdStatus: 'verified', emdAmount: 25000,
    paymentStatus: 'confirmed', paymentClientAmount: 285500, paymentCommissionAmount: 15000, paymentUTR: 'HDFC2603290056781',
    handoverStatus: 'acknowledged', handoverGatePass: 'GP-2026-0289', handoverDate: '2026-04-18T08:00:00.000Z',
    reconciliationStatus: 'submitted',
    reconciliationFinalWeight: 3350, reconciliationFinalQuantity: 6, reconciliationFinalValue: 282000,
    reconciliationNotes: 'One unit had missing compressor housing — 50kg short. Adjusted commercial value accordingly.',
    reconciliationSubmittedAt: '2026-04-20T14:00:00.000Z',
    complianceStatus: 'documents_uploaded', pickupScheduledDate: '2026-04-18T08:00:00.000Z',
    images: ['https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=800&q=80']
  },

  // ── FULLY COMPLETED — all steps done ─────────────────────────────────────
  {
    id: 'ECO18995', title: 'Enterprise Printer Fleet Disposal (60 Units)', category: 'Other',
    weight: 720, location: 'MG Road, Bangalore', status: 'completed', userId: 'C1',
    userName: 'Tech Corp Ltd', description: 'HP and Xerox laser printers. Toner cartridges removed. Drums wiped. Includes 8 heavy-duty production printers.',
    createdAt: '2026-03-10T10:00:00.000Z', urgency: 'low', bidCount: 4, viewCount: 87,
    auctionPhase: 'completed', basePrice: 42000, bidIncrement: 1000,
    winnerVendorId: 'V1', winnerVendorName: 'Green Recyclers Pvt Ltd',
    finalQuoteStatus: 'approved',
    poStatus: 'acknowledged', poNumber: 'WC-2026-0031', poIssuedAt: '2026-03-18T09:00:00.000Z',
    emdStatus: 'not_required',
    paymentStatus: 'confirmed', paymentClientAmount: 49400, paymentCommissionAmount: 2600,
    handoverStatus: 'acknowledged', handoverGatePass: 'GP-2026-0256', handoverDate: '2026-04-10T08:00:00.000Z',
    reconciliationStatus: 'verified', reconciliationFinalWeight: 720, reconciliationFinalQuantity: 60, reconciliationFinalValue: 52000,
    complianceStatus: 'verified', pickupScheduledDate: '2026-04-10T08:00:00.000Z',
    form6Url: 'data:text/plain;base64,Rm9ybTY=',
    weightSlipEmptyUrl: 'data:text/plain;base64,V2VpZ2h0RW1wdHk=',
    weightSlipLoadedUrl: 'data:text/plain;base64,V2VpZ2h0TG9hZGVk',
    recyclingCertUrl: 'data:text/plain;base64,UmVjeWNsaW5nQ2VydA==',
    disposalCertUrl: 'data:text/plain;base64,RGlzcG9zYWxDZXJ0',
    images: ['https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?auto=format&fit=crop&w=800&q=80']
  },
];

const MOCK_BIDS: Bid[] = [
  { id: 'B1-0', listingId: 'ECO18951', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 21200, status: 'pending', type: 'open', createdAt: '2026-04-16T14:45:00.000Z' },
  { id: 'B2-0', listingId: 'ECO18951', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 21400, status: 'pending', type: 'open', createdAt: '2026-04-16T14:50:00.000Z' },
  { id: 'B1-1', listingId: 'ECO18951', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 21800, status: 'pending', type: 'open', createdAt: '2026-04-16T15:10:00.000Z' },
  { id: 'B2-1', listingId: 'ECO18951', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 22100, status: 'pending', type: 'open', createdAt: '2026-04-16T15:20:00.000Z' },
  { id: 'B1', listingId: 'ECO18951', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 22500, status: 'pending', type: 'open', createdAt: '2026-04-16T15:30:00.000Z' },
  { id: 'B2', listingId: 'ECO18951', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 22600, status: 'pending', type: 'open', createdAt: '2026-04-16T15:35:00.000Z' },
  { id: 'B3-0', listingId: 'ECO18951', vendorId: 'V3', vendorName: 'RecycleFirst India', amount: 22800, status: 'pending', type: 'open', createdAt: '2026-04-16T15:45:00.000Z' },
  { id: 'B11', listingId: 'ECO18951', vendorId: 'V3', vendorName: 'RecycleFirst India', amount: 23000, status: 'pending', type: 'open', createdAt: '2026-04-16T15:50:00.000Z' },
  { id: 'B3', listingId: 'ECO18950', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 145000, status: 'pending', type: 'sealed', createdAt: '2026-04-16T14:00:00.000Z' },
  { id: 'B4', listingId: 'ECO18950', vendorId: 'V3', vendorName: 'RecycleFirst India', amount: 152000, status: 'pending', type: 'sealed', createdAt: '2026-04-16T12:00:00.000Z' },
  { id: 'B5', listingId: 'ECO18937', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 48000, status: 'accepted', type: 'open', createdAt: '2026-04-12T11:00:00.000Z' },
  { id: 'B6', listingId: 'ECO18972', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 465000, status: 'pending', type: 'open', createdAt: '2026-04-16T15:00:00.000Z' },
  { id: 'B7', listingId: 'ECO18972', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 470000, status: 'pending', type: 'open', createdAt: '2026-04-16T15:40:00.000Z' },
  { id: 'B8', listingId: 'ECO18980', vendorId: 'V3', vendorName: 'RecycleFirst India', amount: 1350000, status: 'accepted', type: 'open', createdAt: '2026-04-14T10:00:00.000Z' },
  { id: 'B12', listingId: 'ECO18910', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 18500, status: 'accepted', type: 'open', createdAt: '2026-03-20T11:00:00.000Z' },
  { id: 'B13', listingId: 'ECO18905', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 72000, status: 'accepted', type: 'open', createdAt: '2026-03-05T14:00:00.000Z' },
  { id: 'B9', listingId: 'ECO18985', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 260000, status: 'pending', type: 'sealed', createdAt: '2026-04-16T15:00:00.000Z' },
  { id: 'B10', listingId: 'ECO18985', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 255000, status: 'pending', type: 'sealed', createdAt: '2026-04-16T14:00:00.000Z' },
  { id: 'CON-B1', listingId: 'CON-L1', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 1500, status: 'accepted', type: 'open', createdAt: '2026-04-14T11:00:00.000Z' },
  { id: 'CON-B2', listingId: 'CON-L2', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 450, status: 'pending', type: 'sealed', createdAt: '2026-04-17T15:00:00.000Z' },
  // New step-6 demo bids
  { id: 'B20', listingId: 'ECO19001', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 175000, status: 'accepted', type: 'open', createdAt: '2026-04-24T17:00:00.000Z' },
  { id: 'B21', listingId: 'ECO19002', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 150000, status: 'accepted', type: 'open', createdAt: '2026-04-20T16:00:00.000Z' },
  // Post-auction demo bids — accepted winners
  { id: 'B14', listingId: 'ECO18992', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 105000, status: 'accepted', type: 'open', createdAt: '2026-04-18T17:55:00.000Z' },
  { id: 'B15', listingId: 'ECO18993', vendorId: 'V3', vendorName: 'RecycleFirst India', amount: 250000, status: 'accepted', type: 'open', createdAt: '2026-04-15T17:58:00.000Z' },
  { id: 'B16', listingId: 'ECO18994', vendorId: 'V2', vendorName: 'EcoMetal Solutions', amount: 300500, status: 'accepted', type: 'open', createdAt: '2026-04-10T17:57:00.000Z' },
  { id: 'B17', listingId: 'ECO18995', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 52000, status: 'accepted', type: 'open', createdAt: '2026-03-25T17:50:00.000Z' },
  { id: 'B18', listingId: 'ECO18996', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 115500, status: 'accepted', type: 'open', createdAt: '2026-04-17T16:40:00.000Z' },
  { id: 'B19', listingId: 'ECO18997', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd', amount: 72000, status: 'accepted', type: 'open', createdAt: '2026-04-06T14:30:00.000Z' },
];

const MOCK_USERS: User[] = [
  { id: 'A1', name: 'Super Admin', role: 'admin', email: 'admin@weconnect.com', status: 'active', registeredAt: '2026-02-15T10:00:00.000Z', onboardingStep: 5 },
  {
    id: 'C1', name: 'Tech Corp Ltd', role: 'client', email: 'client@weconnect.com', status: 'active', phone: '+91 98765 43210', registeredAt: '2026-03-01T10:00:00.000Z', onboardingStep: 5,
    bankDetails: { accountHolderName: 'Tech Corp Ltd', bankName: 'HDFC Bank', accountNumber: '50100234567890', ifscCode: 'HDFC0001234', accountType: 'current' as const },
  },
  { id: 'C2', name: 'Global Infra Pvt Ltd', role: 'client', email: 'info@globalinfra.com', status: 'active', phone: '+91 87654 32109', registeredAt: '2026-03-15T10:00:00.000Z', onboardingStep: 5 },
  { id: 'C3', name: 'Manufacturing Hub', role: 'client', email: 'ops@manhub.com', status: 'active', phone: '+91 76543 21098', registeredAt: '2026-03-25T10:00:00.000Z', onboardingStep: 5 },
  { id: 'V1', name: 'Green Recyclers Pvt Ltd', role: 'vendor', email: 'vendor@weconnect.com', status: 'active', phone: '+91 76543 21098', registeredAt: '2026-03-05T10:00:00.000Z', onboardingStep: 5 },
  { id: 'V2', name: 'EcoMetal Solutions', role: 'vendor', email: 'info@ecometal.com', status: 'active', phone: '+91 65432 10987', registeredAt: '2026-03-20T10:00:00.000Z', onboardingStep: 5 },
  { id: 'V3', name: 'RecycleFirst India', role: 'vendor', email: 'ops@recyclefirst.in', status: 'active', phone: '+91 54321 09876', registeredAt: '2026-04-01T10:00:00.000Z', onboardingStep: 5 },
  {
    id: 'V4', name: 'PureRecovery Solutions', role: 'vendor', email: 'contact@purerecovery.com',
    status: 'pending', phone: '+91 43210 98765', registeredAt: '2026-04-14T10:00:00.000Z', onboardingStep: 4,
    onboardingProfile: {
      companyName: 'PureRecovery Solutions Pvt Ltd', contactPerson: 'Arjun Mehta',
      email: 'contact@purerecovery.com', phone: '+91 43210 98765',
      address: 'Plot 14, Sector 18, HSIIDC Industrial Area', city: 'Faridabad',
      state: 'Haryana', pincode: '121002',
      companyRegistrationNo: 'U90000HR2019PTC082341', processingCapacity: '500 MT / Month',
      materialSpecializations: ['IT Equipment', 'Batteries', 'Components'],
      cpcbNo: 'CPCB/R/HR/2021/0842',
    },
    documents: [
      { name: 'CPCB Certificate', fileName: 'CPCB_Certificate_PureRecovery.pdf', size: '2.1 MB', uploadedAt: '2026-04-14T10:00:00.000Z', status: 'pending' },
      { name: 'GST Certificate', fileName: 'GST_PureRecovery.pdf', size: '1.2 MB', uploadedAt: '2026-04-14T10:05:00.000Z', status: 'pending' },
      { name: 'Company Registration', fileName: 'CIN_PureRecovery.pdf', size: '3.4 MB', uploadedAt: '2026-04-14T10:10:00.000Z', status: 'pending' },
      { name: 'EMD Proof', fileName: 'EMD_BankReceipt.pdf', size: '0.8 MB', uploadedAt: '2026-04-14T10:15:00.000Z', status: 'pending' },
    ],
    bankDetails: {
      accountHolderName: 'PureRecovery Solutions Pvt Ltd', bankName: 'HDFC Bank',
      accountNumber: '50200012345678', ifscCode: 'HDFC0001234', accountType: 'current',
    },
  },
  {
    id: 'V5', name: 'Urban Miners', role: 'vendor', email: 'hello@urbanminers.com',
    status: 'pending', phone: '+91 32109 87654', registeredAt: '2026-04-15T10:00:00.000Z', onboardingStep: 2,
    onboardingProfile: {
      companyName: 'Urban Miners', contactPerson: 'Priya Nair',
      email: 'hello@urbanminers.com', phone: '+91 32109 87654',
      address: '7B, Anna Salai, Nungambakkam', city: 'Chennai',
      state: 'Tamil Nadu', pincode: '600034',
      companyRegistrationNo: 'U90000TN2023PTC145678', processingCapacity: '200 MT / Month',
      materialSpecializations: ['Mobile Devices', 'Cables & Wiring'],
      cpcbNo: 'Application Pending',
    },
  },
  {
    id: 'C4', name: 'InnoTech Systems Pvt Ltd', role: 'client', email: 'admin@innotech.in',
    status: 'pending', phone: '+91 22334 55667', registeredAt: '2026-04-18T09:00:00.000Z', onboardingStep: 3,
    onboardingProfile: {
      companyName: 'InnoTech Systems Pvt Ltd', contactPerson: 'Vikram Rao',
      email: 'admin@innotech.in', phone: '+91 22334 55667',
      address: '302, Amar Tower, Bandra Kurla Complex', city: 'Mumbai',
      state: 'Maharashtra', pincode: '400051',
      gstin: '27AABCI9999A1Z5', industrySector: 'Information Technology',
      numberOfEmployees: '201-500',
    },
    documents: [
      { name: 'GST Certificate', fileName: 'GST_InnoTech.pdf', size: '1.5 MB', uploadedAt: '2026-04-18T09:00:00.000Z', status: 'pending' },
      { name: 'Company Incorporation', fileName: 'CIN_InnoTech.pdf', size: '2.2 MB', uploadedAt: '2026-04-18T09:05:00.000Z', status: 'pending' },
      { name: 'Address Proof', fileName: 'AddressProof_InnoTech.pdf', size: '1.1 MB', uploadedAt: '2026-04-18T09:10:00.000Z', status: 'pending' },
    ],
  },
  { id: 'G1', name: 'Individual User', role: 'guest', email: 'guest@weconnect.com', status: 'active', registeredAt: '2026-04-16T13:00:00.000Z', onboardingStep: 5 },
  { id: 'CON1', name: 'Rahul Sharma', role: 'consumer', email: 'consumer@weconnect.com', status: 'active', phone: '+91 91234 56789', registeredAt: '2026-04-16T13:00:00.000Z', onboardingStep: 5 },
];

const MOCK_AUDIT_INVITATIONS: AuditInvitation[] = [
  {
    id: 'AUD1', listingId: 'ECO18990', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd',
    status: 'accepted', invitedAt: '2026-04-19T12:00:00.000Z', scheduledDate: '2026-04-22T10:00:00.000Z',
    spocName: 'Ravi Kumar', spocPhone: '+91 98001 11222', siteAddress: 'MG Road, Bangalore',
  },
  {
    id: 'AUD2', listingId: 'ECO18990', vendorId: 'V3', vendorName: 'RecycleFirst India',
    status: 'completed', invitedAt: '2026-04-19T12:00:00.000Z', scheduledDate: '2026-04-21T09:00:00.000Z',
    spocName: 'Ravi Kumar', spocPhone: '+91 98001 11222', siteAddress: 'MG Road, Bangalore',
    productMatch: true, auditRemarks: 'All 40 desktop units verified. Condition matches description.', completedAt: '2026-04-21T11:30:00.000Z',
  },
  {
    id: 'AUD3', listingId: 'ECO18950', vendorId: 'V2', vendorName: 'EcoMetal Solutions',
    status: 'invited', invitedAt: '2026-04-20T09:00:00.000Z',
    spocName: 'Anita Sharma', spocPhone: '+91 98002 33444', siteAddress: 'Whitefield, Bangalore',
  },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'N1', userId: 'C1', type: 'bid_received', title: 'New Bid Received', message: 'Green Recyclers placed a bid of ₹22,500 on your CRT Monitor listing.', read: false, createdAt: '2026-04-16T15:45:00.000Z' },
  { id: 'N2', userId: 'C1', type: 'bid_received', title: 'New Bid Received', message: 'EcoMetal Solutions placed a bid of ₹21,500 on your CRT Monitor listing.', read: false, createdAt: '2026-04-16T15:15:00.000Z' },
  { id: 'N3', userId: 'V1', type: 'bid_accepted', title: 'Bid Accepted!', message: 'Your bid of ₹48,000 on Battery Storage Block has been accepted.', read: true, createdAt: '2026-04-13T10:00:00.000Z' },
  { id: 'N4', userId: 'C3', type: 'bid_received', title: 'Live Bid Received', message: 'Green Recyclers just bid ₹470,000 on Industrial Copper Wiring.', read: false, createdAt: '2026-04-16T15:40:00.000Z' },
  { id: 'N5', userId: 'V4', type: 'account_approved', title: 'Account Under Review', message: 'Admin is currently reviewing your documents.', read: false, createdAt: '2026-04-15T10:00:00.000Z' },
  { id: 'N6', userId: 'C1', type: 'bid_received', title: 'Highest Bid Alert', message: 'RecycleFirst India just placed a new high bid on CRT Monitors.', read: false, createdAt: '2026-04-16T15:50:00.000Z' },
  { id: 'CON-N1', userId: 'CON1', type: 'bid_accepted', title: 'Pick-up Scheduled', message: 'Your LED TV disposal request has been confirmed. Payout of ₹1,500 will be settled post verification.', read: false, createdAt: '2026-04-15T10:00:00.000Z' },
  { id: 'CON-N2', userId: 'CON1', type: 'general', title: 'New Achievement 🌳', message: 'You have neutralized 42KG of Carbon this month. Check your impact score!', read: false, createdAt: '2026-04-17T10:00:00.000Z' },
];

const MOCK_VENDOR_RATINGS: VendorRating[] = [
  {
    id: 'RV1', listingId: 'ECO18995', vendorId: 'V1', vendorName: 'Green Recyclers Pvt Ltd',
    clientId: 'C1', clientName: 'Tech Corp Ltd',
    overallRating: 5, auditRating: 5, timelinessRating: 4, complianceRating: 5,
    comment: 'Excellent service. Audit was thorough, pickup was on time, and all compliance documents submitted without any follow-up.',
    createdAt: '2026-04-12T10:00:00.000Z',
  },
  {
    id: 'RV2', listingId: 'ECO18994', vendorId: 'V2', vendorName: 'EcoMetal Solutions',
    clientId: 'C1', clientName: 'Tech Corp Ltd',
    overallRating: 4, auditRating: 4, timelinessRating: 5, complianceRating: 3,
    comment: 'Good pickup coordination. Compliance documents needed one reminder but were submitted correctly.',
    createdAt: '2026-04-20T11:00:00.000Z',
  },
];

const initialState: AppState = {
  currentUser: null,
  listings: [],
  bids: [],
  users: [],
  notifications: [],
  auditInvitations: [],
  vendorRatings: [],
  pendingOnboardingRole: undefined,
  pendingOnboardingEmail: undefined,
  pendingOnboardingPassword: undefined,
  isSidebarOpen: false,
  isSidebarCollapsed: false,
  theme: 'light',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Try to restore saved state from localStorage first
      try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          setState(prev => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        // Ignore localStorage parse errors
      }

      // Try to authenticate with backend
      try {
        const savedToken = localStorage.getItem('ecoloop_token');
        if (savedToken) {
          const profileRes = await api.get('/auth/profile');
          const user = mapBackendUser(profileRes.data);
          setState(prev => ({
            ...prev,
            currentUser: user,
          }));
          await fetchAllData();
        }
      } catch (e: any) {
        // Only clear token on explicit 401 (invalid/expired) — not on network errors
        if (e?.response?.status === 401) {
          localStorage.removeItem('ecoloop_token');
          setState(prev => ({ ...prev, currentUser: null }));
        }
        console.error('Backend unavailable or token expired, using local state', e);
        // Load mock data only if backend is completely unreachable and no data exists
        if (!e?.response) {
          setState(prev => {
            if (prev.listings.length === 0) {
              return {
                ...prev,
                listings: MOCK_LISTINGS,
                bids: MOCK_BIDS,
                users: MOCK_USERS,
                notifications: MOCK_NOTIFICATIONS,
                auditInvitations: MOCK_AUDIT_INVITATIONS,
                vendorRatings: MOCK_VENDOR_RATINGS,
              };
            }
            return prev;
          });
        }
      } finally {
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        const savedState = {
          theme: state.theme,
          isSidebarOpen: state.isSidebarOpen,
          isSidebarCollapsed: state.isSidebarCollapsed,
          currentUser: state.currentUser,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
      } catch (e) {
        // Silently handle quota errors
      }
    }
  }, [state.theme, state.isSidebarOpen, state.isSidebarCollapsed, state.currentUser, isInitialized]);

  // Removed aggressive polling to save Firestore quota
  // Instead, the app relies on manual refreshes or specific action triggers.
  useEffect(() => {
    if (!isInitialized || !state.currentUser) return;
    // const interval = setInterval(() => {
    //   fetchAllData().catch(() => {});
    // }, 30000);
    // return () => clearInterval(interval);
  }, [isInitialized, state.currentUser?.id]);

  const mapRequirementToListing = (req: any): Listing => {
    // Derive auctionPhase from auction status; new requirements without auction show as 'pending'
    const rawPhase = req.auction?.status?.toLowerCase();
    let auctionPhase: string;
    if (!rawPhase || rawPhase === 'draft') {
      auctionPhase = 'pending'; // show in client listings, admin pending view
    } else if (rawPhase === 'upcoming') {
      auctionPhase = 'invitation_window';
    } else if (rawPhase === 'sealed_phase') {
      auctionPhase = 'sealed_bid';
    } else if (rawPhase === 'open_phase') {
      auctionPhase = 'live';
    } else if (rawPhase === 'completed' || rawPhase === 'pending_selection') {
      auctionPhase = 'completed';
    } else {
      auctionPhase = rawPhase;
    }

    const statusMap: Record<string, Listing['requirementStatus']> = {
      UPLOADED: 'pending',
      PROCESSING: 'processing',
      CLIENT_REVIEW: 'client_review',
      FINALIZED: 'finalized',
      REJECTED: 'rejected',
    };

    const auctionStartDate = req.auction?.openPhaseStart
      ? new Date(req.auction.openPhaseStart).toISOString()
      : undefined;
    const auctionEndDate = req.auction?.openPhaseEnd
      ? new Date(req.auction.openPhaseEnd).toISOString()
      : undefined;

    const liveApprovalStatus = req.auction?.liveApprovalStatus;

    return {
      id: req.id,
      title: req.title,
      description: req.description,
      category: req.category || req.auction?.category || 'General',
      weight: req.totalWeight || req.auction?.totalWeight || 0,
      location: req.siteAddress || req.client?.city || 'Various',
      status: req.status === 'APPROVED' || req.status === 'FINALIZED' ? 'active' : 'pending',
      userId: req.clientId,
      userName: req.client?.name || 'Company Client',
      createdAt: req.createdAt,
      urgency: req.urgency || 'medium',
      auctionPhase: auctionPhase as any,
      basePrice: req.auction?.basePrice || 0,
      bidIncrement: req.auction?.bidIncrement || req.auction?.tickSize || 1000,
      highestEmdAmount: req.auction?.highestEmdAmount || 0,
      invitedVendorIds: (req.vendorInvites || []).map((v: any) => v.vendorId),
      acceptedVendorIds: req.acceptedVendorIds ?? [],
      declinedVendorIds: req.declinedVendorIds ?? [],
      sealedBidStartDate: req.auction?.sealedPhaseStart || req.sealedPhaseStart,
      sealedBidEndDate: req.auction?.sealedPhaseEnd || req.sealedPhaseEnd,
      auctionStartDate,
      auctionEndDate,
      requirementId: req.id,
      auctionId: req.auction?.id,
      liveConfigured: liveApprovalStatus === 'approved',
      requirementStatus: statusMap[req.status] ?? undefined,
      poStatus: req.auction?.poNumber ? 'issued' : undefined,
      poNumber: req.auction?.poNumber,
      poPaymentTerms: req.auction?.poPaymentTerms,
      poDeliveryTerms: req.auction?.poDeliveryTerms,
      poPenaltyClause: req.auction?.poPenaltyClause,
      poSpecialConditions: req.auction?.poSpecialConditions,
    } as Listing;
  };

  const mapUserProductToListing = (p: any): Listing => {
    return {
      id: p.id,
      title: p.name,
      description: p.description || '',
      category: p.category || 'Individual',
      weight: p.weightKg || 0,
      location: p.city || 'Unknown',
      userId: p.userId,
      userName: p.user?.name || 'Individual User',
      createdAt: p.createdAt,
      auctionPhase: p.status === 'COMPLETED' ? 'completed' : 'live',
      status: p.status === 'COMPLETED' ? 'completed' : 'active',
      targetPrice: p.askingPrice,
      requirementId: p.id,
      requirementStatus: p.status,
      images: p.photoUrls || [],
    } as Listing;
  };

  const mapBackendUser = (u: any): User => {
    if (!u) return {} as User;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: (u.role || 'guest').toLowerCase() as UserRole,
      companyId: u.companyId,
      status: u.isActive ? 'active' : 'pending',
      onboardingStep: u.companyId ? 5 : 1,
      registeredAt: u.createdAt,
      onboardingProfile: u.company ? {
        companyName: u.company.name,
        contactPerson: u.name,
        email: u.email,
        phone: u.phone || '',
        address: u.company.address || '',
        city: u.company.city || '',
        state: u.company.state || '',
        pincode: u.company.pincode || '',
        gstin: u.company.gstNumber || '',
        industrySector: u.company.industrySector || '',
      } : undefined,
    } as User;
  };

  const fetchAllData = async () => {
    try {
      const [requirementsRes, userProductsRes, bidsRes, usersRes, auctionsRes, auditsRes, notificationsRes] = await Promise.all([
        api.get('/requirements').catch(() => ({ data: [] })),
        api.get('/user-products/admin/all').catch(() => ({ data: [] })),
        api.get('/auctions/bids').catch(() => ({ data: [] })),
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/auctions').catch(() => ({ data: [] })),
        api.get('/audits/invitations').catch(() => ({ data: [] })),
        api.get('/notifications').catch(() => ({ data: [] })),
      ]);

      const backendListings = [
        ...(requirementsRes.data || []).map(mapRequirementToListing),
        ...(userProductsRes.data || []).map(mapUserProductToListing),
      ];
      
      const backendBidsRaw = bidsRes.data || [];
      const bidsByAuction: Record<string, any[]> = {};
      const backendBids = backendBidsRaw.map((b: any) => {
        return {
          ...b,
          vendorName: b.vendorName || b.vendor?.name || b.vendor?.company?.name || 'Unknown Vendor',
          status: 'pending',
          type: b.phase?.toLowerCase() || 'open',
          listingId: b.auction?.requirementId || b.auctionId,
        };
      });

      backendBids.forEach((b: any) => {
        if (!bidsByAuction[b.auctionId]) {
          bidsByAuction[b.auctionId] = [];
        }
        bidsByAuction[b.auctionId].push(b);
      });

      Object.keys(bidsByAuction).forEach(auctionId => {
        const auctionBids = bidsByAuction[auctionId];
        // Sort bids descending by amount
        auctionBids.sort((x, y) => y.amount - x.amount);
        const highestBid = auctionBids[0];
        
        if (highestBid && highestBid.auction?.status === 'COMPLETED') {
          const winnerId = highestBid.auction.winnerId;
          const winnerCompanyId = highestBid.vendor?.companyId;
          if (winnerId && winnerCompanyId === winnerId) {
            highestBid.status = 'accepted';
            // Mark other bids for this auction as rejected
            auctionBids.slice(1).forEach(otherBid => {
              otherBid.status = 'rejected';
            });
          } else {
            auctionBids.forEach(bid => {
              bid.status = 'rejected';
            });
          }
        }
      });

      const backendUsers = (usersRes.data || []).map(mapBackendUser);

      // Map backend audit invitations to frontend shape
      const backendAudits = (auditsRes.data || []).map((a: any) => ({
        id: a.id,
        listingId: a.requirementId,
        vendorId: a.vendorId,
        vendorName: a.vendor?.name || a.vendorId,
        status: (a.status || '').toLowerCase(),
        invitedAt: a.createdAt,
        scheduledDate: a.scheduledAt,
        spocName: a.spocName,
        spocPhone: a.spocPhone,
        siteAddress: a.siteAddress,
        productMatch: a.report?.productMatch,
        auditRemarks: a.report?.remarks,
        completedAt: a.report?.completedAt,
      }));

      const backendNotifications = (notificationsRes.data || []).map((n: any) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: n.createdAt,
      }));

      setState(prev => {
        const hasBackendListings = backendListings.length > 0;
        const hasBackendUsers = backendUsers.length > 0;
        const isAdmin = prev.currentUser?.role === 'admin';

        // Preserve local state for fields not yet fully implemented in the backend (e.g. closingDocuments, images)
        const mergedListings = hasBackendListings ? backendListings.map(bl => {
          const existing = prev.listings.find(pl => pl.id === bl.id);
          if (existing) {
            return {
              ...bl,
              closingDocuments: (bl.closingDocuments?.length) ? bl.closingDocuments : existing.closingDocuments,
              images: (bl.images?.length) ? bl.images : existing.images,
              urgency: bl.urgency || existing.urgency,
              bidCount: bl.bidCount !== undefined ? bl.bidCount : existing.bidCount,
              viewCount: bl.viewCount !== undefined ? bl.viewCount : existing.viewCount,
            };
          }
          return bl;
        }) : prev.listings;

        // For admin users: always include MOCK_LISTINGS so all admin accounts see the
        // same demo data regardless of which admin account is used.
        // Mock listings are prepended only if their IDs don't exist in the backend result.
        const backendListingIds = new Set(mergedListings.map((l: any) => l.id));
        const mockOnlyListings = isAdmin
          ? MOCK_LISTINGS.filter(ml => !backendListingIds.has(ml.id))
          : [];
        const finalListings = isAdmin
          ? [...mergedListings, ...mockOnlyListings]
          : mergedListings;

        // For admin users: merge mock bids for mock listings
        const backendBidListingIds = new Set(backendBids.map((b: any) => b.listingId));
        const mockOnlyBids = isAdmin
          ? MOCK_BIDS.filter(mb => !backendBidListingIds.has(mb.listingId))
          : [];
        const finalBids = isAdmin && backendBids.length > 0
          ? [...backendBids, ...mockOnlyBids]
          : backendBids.length > 0 ? backendBids : prev.bids;

        // For admin users: merge mock users that don't exist in the backend list
        const backendUserIds = new Set(backendUsers.map((u: any) => u.id));
        const mockOnlyUsers = isAdmin
          ? MOCK_USERS.filter(mu => !backendUserIds.has(mu.id))
          : [];
        const finalUsers = isAdmin && hasBackendUsers
          ? [...backendUsers, ...mockOnlyUsers]
          : hasBackendUsers ? backendUsers : prev.users;

        // For admin users: merge mock audit invitations
        const backendAuditIds = new Set(backendAudits.map((a: any) => a.id));
        const mockOnlyAudits = isAdmin
          ? MOCK_AUDIT_INVITATIONS.filter(ma => !backendAuditIds.has(ma.id))
          : [];
        const finalAudits = isAdmin && backendAudits.length > 0
          ? [...backendAudits, ...mockOnlyAudits]
          : backendAudits.length > 0 ? backendAudits : prev.auditInvitations;

        return {
          ...prev,
          listings: finalListings,
          bids: finalBids,
          users: finalUsers,
          auditInvitations: finalAudits,
          notifications: backendNotifications.length > 0 ? backendNotifications : prev.notifications,
        };
      });
    } catch (error) {
      console.error('Failed to fetch data, using local state', error);
    }
  };

  const login = async (role: UserRole, email: string, password?: string): Promise<User> => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { access_token } = res.data;
      localStorage.setItem('ecoloop_token', access_token);

      const profileRes = await api.get('/auth/profile');
      const user = mapBackendUser(profileRes.data);

      setState(prev => ({
        ...prev,
        currentUser: user,
      }));

      await fetchAllData();
      return user;
    } catch (error: any) {
      // Mock fallback: if backend is unreachable (no HTTP response), allow demo accounts
      if (!error.response) {
        const mockUser = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (mockUser && password === 'password') {
          setState(prev => ({
            ...prev,
            currentUser: mockUser,
            // Load mock data only if not already present (preserve any mid-session state updates)
            ...(prev.listings.length === 0 ? {
              listings: MOCK_LISTINGS,
              bids: MOCK_BIDS,
              users: MOCK_USERS,
              notifications: MOCK_NOTIFICATIONS,
              auditInvitations: MOCK_AUDIT_INVITATIONS,
              vendorRatings: MOCK_VENDOR_RATINGS,
            } : {
              users: prev.users.length === 0 ? MOCK_USERS : prev.users,
            }),
          }));
          return mockUser;
        }
      }
      console.error('Login failed', error);
      throw error;
    }
  };

  const register = async (role: UserRole, name: string, email: string, password?: string, phone?: string): Promise<{ devEmailOtp?: string; devPhoneOtp?: string; resumed?: boolean; resumeStep?: number }> => {
    try {
      const res = await api.post('/auth/register', { name, email, password, role, phone });
      const { access_token, otp, resumed, resumeStep } = res.data;
      localStorage.setItem('ecoloop_token', access_token);

      const profileRes = await api.get('/auth/profile');
      const user = mapBackendUser(profileRes.data);

      setState(prev => ({
        ...prev,
        currentUser: user,
        users: resumed ? prev.users.map(u => u.id === user.id ? user : u) : [...prev.users, user],
      }));

      await fetchAllData();
      return { devEmailOtp: otp?.devEmailOtp, devPhoneOtp: otp?.devPhoneOtp, resumed, resumeStep };
    } catch (error) {
      console.error('Registration failed', error);
      throw error;
    }
  };

  const startOnboarding = (role: 'client' | 'vendor' | 'consumer', email: string, password: string) => {
    setState(prev => ({
      ...prev,
      pendingOnboardingRole: role,
      pendingOnboardingEmail: email,
      pendingOnboardingPassword: password,
    }));
  };

  const saveOnboardingProfile = async (profile: OnboardingProfile) => {
    try {
      let companyId = state.currentUser?.companyId;
      if (companyId) {
        await api.patch(`/companies/${companyId}`, {
          name: profile.companyName,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          gstNumber: profile.gstin,
        });
      } else if (state.currentUser) {
        const res = await api.post('/companies', {
          name: profile.companyName,
          type: state.currentUser.role === 'vendor' ? 'VENDOR' : 'CLIENT',
          address: profile.address,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          gstNumber: profile.gstin,
        });
        companyId = res.data.id;
      }
      
      setState(prev => {
        if (!prev.currentUser) {
          const role = prev.pendingOnboardingRole || 'client';
          const newUser: User = {
            id: `${role[0].toUpperCase()}${Date.now()}`,
            name: profile.companyName,
            role,
            email: prev.pendingOnboardingEmail || profile.email,
            phone: profile.phone,
            status: 'pending',
            onboardingStep: 2,
            onboardingProfile: profile,
            registeredAt: new Date().toISOString(),
          };
          return { ...prev, currentUser: newUser, users: [...prev.users, newUser] };
        }
        const updated = { ...prev.currentUser, companyId, onboardingProfile: profile, onboardingStep: 2 };
        return {
          ...prev, currentUser: updated,
          users: prev.users.map(u => u.id === updated.id ? updated : u),
        };
      });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to save profile', error);
      throw error;
    }
  };

  const saveOnboardingDocuments = async (docs: UploadedDoc[]) => {
    const companyId = state.currentUser?.companyId;
    if (companyId) {
      await Promise.allSettled(
        docs.filter(d => d._rawFile).map(async (doc) => {
          const { DOC_KEY_TO_TYPE } = await import('@/types');
          const docType = DOC_KEY_TO_TYPE[doc.name] || 'OTHER';
          const fd = new FormData();
          fd.append('file', doc._rawFile!);
          fd.append('type', docType);
          await api.post(`/companies/${companyId}/documents`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }),
      );
    }
    setState(prev => {
      if (!prev.currentUser) return prev;
      const updated = { ...prev.currentUser, documents: docs, onboardingStep: 3 };
      return { ...prev, currentUser: updated, users: prev.users.map(u => u.id === updated.id ? updated : u) };
    });
  };

  const saveOnboardingBankDetails = async (bank: BankDetails, chequeFile?: File) => {
    const companyId = state.currentUser?.companyId;
    if (companyId) {
      try {
        await api.patch(`/companies/${companyId}`, {
          bankAccountHolder: bank.accountHolderName,
          bankName: bank.bankName,
          bankAccountNumber: bank.accountNumber,
          bankIfscCode: bank.ifscCode,
          bankAccountType: bank.accountType,
        });
        if (chequeFile) {
          const fd = new FormData();
          fd.append('file', chequeFile);
          fd.append('type', 'CANCELLED_CHEQUE');
          await api.post(`/companies/${companyId}/documents`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      } catch (e) {
        console.error('Failed to persist bank details to API', e);
      }
    }
    setState(prev => {
      if (!prev.currentUser) return prev;
      const updated = { ...prev.currentUser, bankDetails: bank, onboardingStep: 4 };
      return { ...prev, currentUser: updated, users: prev.users.map(u => u.id === updated.id ? updated : u) };
    });
  };

  const completeOnboarding = async () => {
    setState(prev => {
      if (!prev.currentUser) return prev;
      const role = prev.currentUser.role;
      const updated = {
        ...prev.currentUser,
        onboardingStep: 5,
        status: role === 'vendor' ? 'pending' as const : 'active' as const,
      };
      return {
        ...prev, currentUser: updated,
        users: prev.users.map(u => u.id === updated.id ? updated : u),
        pendingOnboardingRole: undefined,
        pendingOnboardingEmail: undefined,
        pendingOnboardingPassword: undefined,
      };
    });
    // Re-fetch fresh profile from backend so layout guards see correct role/status
    try {
      const profileRes = await api.get('/auth/profile');
      const freshUser = mapBackendUser(profileRes.data);
      setState(prev => ({
        ...prev,
        currentUser: { ...freshUser, onboardingStep: 5 },
        pendingOnboardingRole: undefined,
        pendingOnboardingEmail: undefined,
        pendingOnboardingPassword: undefined,
      }));
    } catch (e) {
      // If profile fetch fails, the local state update above is still valid
      console.error('Failed to refresh profile after onboarding', e);
    }
  };

  const logout = () => {
    localStorage.removeItem('ecoloop_token');
    setState(prev => ({ ...prev, currentUser: null }));
  };

  const addListing = async (listing: Omit<Listing, 'id' | 'createdAt' | 'status'> & {
    _rawFiles?: Record<string, File>;
  }) => {
    try {
      const formData = new FormData();
      formData.append('title', listing.title);
      formData.append('description', listing.description);
      formData.append('category', listing.category);
      formData.append('totalWeight', String(listing.weight));
      formData.append('location', listing.location || '');
      if (listing.pickupAddress) formData.append('pickupAddress', listing.pickupAddress);
      if (listing.sealedBidStartDate) formData.append('sealedPhaseStart', listing.sealedBidStartDate);
      if (listing.sealedBidEndDate) formData.append('sealedPhaseEnd', listing.sealedBidEndDate);
      if (listing.invitedVendorIds?.length) {
        formData.append('invitedVendorIds', JSON.stringify(listing.invitedVendorIds));
      }

      // Attach raw File objects for each document if provided
      if (listing._rawFiles) {
        const materialListFile = listing._rawFiles['material_list'];
        if (materialListFile) formData.append('file', materialListFile);

        const documentTypes: string[] = [];
        for (const [type, file] of Object.entries(listing._rawFiles)) {
          if (type !== 'material_list') {
            formData.append('documents', file);
            documentTypes.push(type);
          }
        }
        if (documentTypes.length > 0) {
          formData.append('documentTypes', JSON.stringify(documentTypes));
        }
      }

      await api.post('/requirements', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to add listing', error);
      throw error;
    }
  };

  const respondToInvitation = async (invitationId: string, status: 'ACCEPTED' | 'REJECTED') => {
    try {
      await api.patch(`/audits/invitations/${invitationId}/respond`, { status });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to respond to invitation', error);
    }
  };

  const PHASE_TO_STATUS: Record<string, string> = {
    draft: 'DRAFT',
    invitation_window: 'UPCOMING',
    sealed_bid: 'SEALED_PHASE',
    live: 'OPEN_PHASE',
    completed: 'COMPLETED',
    open_configuration: 'UPCOMING',
  };

  const transitionAuctionPhase = async (listingId: string, nextPhase: Listing['auctionPhase']) => {
    const listing = state.listings.find(l => l.id === listingId);
    const auctionId = listing?.auctionId || listingId;
    const backendStatus = PHASE_TO_STATUS[nextPhase ?? ''];
    if (backendStatus) {
      try {
        await api.patch(`/auctions/${auctionId}/status`, { status: backendStatus });
        await fetchAllData();
        return;
      } catch (error) {
        console.error('Failed to transition auction phase via API, updating locally', error);
      }
    }
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { ...l, auctionPhase: nextPhase } : l)
    }));
  };

  const addBid = async (listingId: string, amount: number, remarks?: string) => {
    console.log(`[App] Adding bid: ₹${amount} for listing ${listingId}`);
    const listing = state.listings.find(l => l.id === listingId);
    const auctionId = listing?.auctionId;
    if (!auctionId) {
      console.error('[App] No auctionId found for listing', listingId);
      throw new Error('No auction found for this listing');
    }
    console.log(`[App] Using auctionId: ${auctionId}`);
    try {
      await api.post(`/auctions/${auctionId}/sealed-bid`, { amount, remarks });
      console.log('[App] Bid successfully submitted via REST');
      await fetchAllData();
    } catch (err: any) {
      console.error('[App] Failed to submit bid via REST:', err?.response?.data || err.message);
      throw err;
    }
  };

  const acceptBid = async (bidId: string) => {
    const bid = state.bids.find(b => b.id === bidId);
    if (!bid) return;
    try {
      // Call backend to select winner (bid.vendorId on the auction)
      await api.patch(`/auctions/${bid.listingId}/winner`, { vendorId: bid.vendorId });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to accept bid via API, updating locally', error);
      setState(prev => ({
        ...prev,
        bids: prev.bids.map(b => b.id === bidId ? { ...b, status: 'accepted' } : b.listingId === bid.listingId ? { ...b, status: 'rejected' } : b),
        listings: prev.listings.map(l => l.id === bid.listingId ? { ...l, status: 'completed', auctionPhase: 'completed' } : l),
      }));
    }
  };

  const updateListingStatus = async (id: string, status: Listing['status'], reason?: string) => {
    // When admin approves a listing → call admin-approve endpoint which creates
    // the auction and sends sealed bid invitation emails to selected vendors
    if (status === 'active') {
      try {
        await api.patch(`/requirements/${id}/admin-approve`);
        await fetchAllData();
      } catch (error) {
        console.error('Admin approve API failed, updating locally', error);
      }
    }
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === id ? { ...l, status, statusReason: reason } : l),
      notifications: status !== 'pending' ? [...prev.notifications, {
        id: `N${Date.now()}`, userId: prev.listings.find(l => l.id === id)?.userId || '', type: 'general' as const, title: `Listing ${status.charAt(0).toUpperCase() + status.slice(1)}`, message: `Your listing status has been updated to ${status}. ${reason || ''}`, read: false, createdAt: new Date().toISOString()
      }] : prev.notifications
    }));
  };

  const uploadProcessedSheet = async (listingId: string, file: File, vendorIds?: string[]) => {
    const fd = new FormData();
    fd.append('file', file);
    if (vendorIds?.length) fd.append('vendorIds', JSON.stringify(vendorIds));
    await api.post(`/requirements/${listingId}/processed-sheet`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await fetchAllData();
  };

  const approveRequirement = async (listingId: string, targetPrice: number, totalWeight?: number) => {
    try {
      await api.patch(`/requirements/${listingId}/approve`, { targetPrice, ...(totalWeight && { totalWeight }) });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to approve requirement', error);
    }
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { ...l, requirementStatus: 'finalized', targetPrice } : l),
    }));
  };

  const updateAuctionPhase = async (id: string, phase: Listing['auctionPhase']) => {
    // Use the actual auction ID when available; listing.id is the requirement ID
    const listing = state.listings.find(l => l.id === id);
    const auctionId = listing?.auctionId || id;
    const backendStatus = PHASE_TO_STATUS[phase ?? ''];
    if (backendStatus) {
      try {
        await api.patch(`/auctions/${auctionId}/status`, { status: backendStatus });
        await fetchAllData();
        return;
      } catch (error) {
        console.error('Failed to update auction phase via API, updating locally', error);
      }
    }
    setState(prev => ({ ...prev, listings: prev.listings.map(l => l.id === id ? { ...l, auctionPhase: phase } : l) }));
  };

  const editListing = (id: string, updates: Partial<Listing>) => {
    setState(prev => ({ ...prev, listings: prev.listings.map(l => l.id === id ? { ...l, ...updates } : l) }));
  };

  const editBid = (id: string, updates: Partial<Bid>) => {
    setState(prev => ({ ...prev, bids: prev.bids.map(b => b.id === id ? { ...b, ...updates } : b) }));
  };

  const updateBidStatus = (id: string, status: Bid['status'], reason?: string) => {
    setState(prev => ({ 
      ...prev, 
      bids: prev.bids.map(b => b.id === id ? { ...b, status, statusReason: reason } : b),
      notifications: [...prev.notifications, {
        id: `N${Date.now()}`, userId: prev.bids.find(b => b.id === id)?.vendorId || '', type: 'general' as const, title: `Bid ${status.charAt(0).toUpperCase() + status.slice(1)}`, message: `Your bid status has been updated to ${status}. ${reason || ''}`, read: false, createdAt: new Date().toISOString()
      }]
    }));
  };

  const updateUserStatus = async (id: string, status: User['status'], reason?: string) => {
    const companyStatusMap: Record<string, string> = {
      active: 'APPROVED', rejected: 'REJECTED', 'on-hold': 'BLOCKED', disabled: 'BLOCKED',
    };
    const backendStatus = companyStatusMap[status];
    if (backendStatus) {
      const user = state.users.find(u => u.id === id);
      if (user?.companyId) {
        await api.patch(`/companies/${user.companyId}/status`, { status: backendStatus }).catch(() => {});
      }
    }
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === id ? { ...u, status, statusReason: reason } : u),
      currentUser: prev.currentUser?.id === id ? { ...prev.currentUser, status } : prev.currentUser,
      notifications: [...prev.notifications, {
        id: `N${Date.now()}`, userId: id, type: 'general' as const, title: `Account ${status.charAt(0).toUpperCase() + status.slice(1)}`, message: `Your account status has been updated to ${status}. ${reason || ''}`, read: false, createdAt: new Date().toISOString()
      }]
    }));
  };

  const assignVendor = (listingId: string, vendorId: string) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { ...l, assignedVendorId: vendorId, status: 'verified' } : l),
      notifications: [...prev.notifications, {
        id: `N${Date.now()}`, userId: vendorId, type: 'general' as const, title: 'New Assignment', message: `You have been assigned to listing ${listingId}.`, read: false, createdAt: new Date().toISOString()
      }]
    }));
  };

  const updateUserProfile = (updates: Partial<User>) => {
    setState(prev => {
      if (!prev.currentUser) return prev;
      const updatedUser = { ...prev.currentUser, ...updates };
      return {
        ...prev,
        currentUser: updatedUser,
        users: prev.users.map(u => u.id === updatedUser.id ? updatedUser : u),
      };
    });
  };

  const changePassword = (newPassword: string) => {
    setState(prev => {
      if (!prev.currentUser) return prev;
      const updatedUser = { ...prev.currentUser, password: newPassword };
      return {
        ...prev,
        currentUser: updatedUser,
        users: prev.users.map(u => u.id === updatedUser.id ? updatedUser : u),
      };
    });
  };

  const deleteAccount = async () => {
    await api.delete('/users/me');
    localStorage.removeItem('ecoloop_token');
    setState(prev => {
      if (!prev.currentUser) return prev;
      const userId = prev.currentUser.id;
      return {
        ...prev,
        currentUser: null,
        users: prev.users.filter(u => u.id !== userId),
        listings: prev.listings.filter(l => l.userId !== userId),
      };
    });
  };

  const addNotification = (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newN: Notification = { ...n, id: `N${Date.now()}`, createdAt: new Date().toISOString(), read: false };
    setState(prev => ({ ...prev, notifications: [newN, ...prev.notifications] }));
  };

  const markNotificationRead = (id: string) => {
    setState(prev => ({ ...prev, notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n) }));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  };

  const markAllNotificationsRead = () => {
    setState(prev => ({ ...prev, notifications: prev.notifications.map(n => ({ ...n, read: true })) }));
    api.patch('/notifications/read-all').catch(() => {});
  };

  const addClosingDocument = (listingId: string, doc: { name: string; url: string; type: string; timestamp: string }) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { 
        ...l, 
        closingDocuments: [...(l.closingDocuments || []), { ...doc, timestamp: new Date().toISOString() }] 
      } : l)
    }));
  };

  const toggleTheme = () => {
    setState(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  };

  const sendAuditInvitations = async (listingId: string, vendorIds: string[], spocName: string, spocPhone: string, siteAddress: string) => {
    try {
      await api.post('/audits/invite', { requirementId: listingId, vendorIds });
      // After inviting, share SPOC for each invitation
      const invitationsRes = await api.get('/audits/invitations', { params: { requirementId: listingId } });
      const invitations = invitationsRes.data || [];
      for (const inv of invitations) {
        if (vendorIds.includes(inv.vendorId)) {
          await api.patch(`/audits/invitations/${inv.id}/spoc`, {
            siteAddress, spocName, spocPhone, scheduledAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }
      await fetchAllData();
    } catch (error) {
      console.error('Failed to send audit invitations via API, updating locally', error);
      setState(prev => {
        const newAudits: AuditInvitation[] = vendorIds.map(vId => {
          const vendor = prev.users.find(u => u.id === vId);
          return {
            id: `AUD${Date.now()}${vId}`,
            listingId, vendorId: vId, vendorName: vendor?.name || vId,
            status: 'invited', invitedAt: new Date().toISOString(),
            spocName, spocPhone, siteAddress,
          };
        });
        return { ...prev, auditInvitations: [...prev.auditInvitations, ...newAudits] };
      });
    }
  };

  const respondToAuditInvitation = async (auditId: string, status: 'accepted' | 'declined') => {
    try {
      const backendStatus = status === 'accepted' ? 'ACCEPTED' : 'REJECTED';
      await api.patch(`/audits/invitations/${auditId}/respond`, { status: backendStatus });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to respond to audit via API, updating locally', error);
      setState(prev => ({
        ...prev,
        auditInvitations: prev.auditInvitations.map(a =>
          a.id === auditId ? { ...a, status } : a
        ),
      }));
    }
  };

  const completeAudit = async (auditId: string, productMatch: boolean, remarks: string) => {
    try {
      await api.post(`/audits/invitations/${auditId}/report`, {
        productMatch: String(productMatch), remarks,
      });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to complete audit via API, updating locally', error);
      setState(prev => ({
        ...prev,
        auditInvitations: prev.auditInvitations.map(a =>
          a.id === auditId ? { ...a, status: 'completed', productMatch, auditRemarks: remarks, completedAt: new Date().toISOString() } : a
        ),
      }));
    }
  };

  // ── Step 6: Purchase Order ─────────────────────────────────────────────
  const issuePO = (listingId: string, data: { paymentTerms: string; deliveryTerms: string; penaltyClause: string; specialConditions: string }) => {
    const listing = state.listings.find(l => l.id === listingId);
    const poNumber = listing?.poNumber || `WC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? {
        ...l, poStatus: 'issued', poNumber, poIssuedAt: new Date().toISOString(),
        poPaymentTerms: data.paymentTerms, poDeliveryTerms: data.deliveryTerms,
        poPenaltyClause: data.penaltyClause, poSpecialConditions: data.specialConditions,
      } : l),
    }));
  };

  const acknowledgePO = (listingId: string) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { ...l, poStatus: 'acknowledged' } : l),
    }));
  };

  // ── Step 6: EMD ────────────────────────────────────────────────────────
  const submitEMD = async (listingId: string, amount: number, utr: string) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? {
        ...l, emdStatus: 'submitted', emdAmount: amount, emdUTR: utr, emdSubmittedAt: new Date().toISOString(),
      } : l),
    }));
  };

  const verifyEMD = (listingId: string) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { ...l, emdStatus: 'verified' } : l),
    }));
  };

  // ── Step 7: Handover Documents ─────────────────────────────────────────
  const createHandoverDocs = (listingId: string, data: { gatePass: string; vehicle: string; driver: string; date: string; notes: string }) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? {
        ...l, handoverStatus: 'created',
        handoverGatePass: data.gatePass, handoverVehicle: data.vehicle,
        handoverDriver: data.driver, handoverDate: data.date, handoverNotes: data.notes,
      } : l),
    }));
  };

  const acknowledgeHandover = (listingId: string) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { ...l, handoverStatus: 'acknowledged' } : l),
    }));
  };

  // ── Step 8: Reconciliation ─────────────────────────────────────────────
  const submitReconciliation = async (listingId: string, finalWeight: number, finalQuantity: number, finalValue: number, notes: string, _file?: File) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? {
        ...l, reconciliationStatus: 'submitted',
        reconciliationFinalWeight: finalWeight, reconciliationFinalQuantity: finalQuantity,
        reconciliationFinalValue: finalValue, reconciliationNotes: notes,
        reconciliationSubmittedAt: new Date().toISOString(),
      } : l),
    }));
  };

  const verifyReconciliation = (listingId: string) => {
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? { ...l, reconciliationStatus: 'verified' } : l),
    }));
  };

  const submitPaymentProof = async (listingId: string, file: File, utrNumber: string) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (utrNumber) fd.append('utrNumber', utrNumber);
      await api.post(`/payments/auction/${listingId}/proof`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to submit payment proof via API, updating locally', error);
      setState(prev => ({
        ...prev,
        listings: prev.listings.map(l => l.id === listingId ? {
          ...l, paymentStatus: 'proof_uploaded',
          paymentUTR: utrNumber, paymentSubmittedAt: new Date().toISOString(),
        } : l),
      }));
    }
  };

  const confirmPayment = async (listingId: string) => {
    try {
      await api.patch(`/payments/auction/${listingId}/confirm`);
      await fetchAllData();
    } catch (error) {
      console.error('Failed to confirm payment via API, updating locally', error);
      setState(prev => ({
        ...prev,
        listings: prev.listings.map(l => l.id === listingId ? {
          ...l, paymentStatus: 'confirmed', complianceStatus: 'pending',
        } : l),
      }));
    }
  };

  const COMP_TYPE_MAP: Record<string, string> = {
    form6: 'FORM_6',
    weightEmpty: 'WEIGHT_SLIP_EMPTY',
    weightLoaded: 'WEIGHT_SLIP_LOADED',
    recycling: 'RECYCLING_CERTIFICATE',
    disposal: 'DISPOSAL_CERTIFICATE',
  };

  const submitComplianceDocs = async (listingId: string, files: Record<string, File | null>, pickupDate?: string) => {
    try {
      const pickupsRes = await api.get('/pickups');
      const pickup = (pickupsRes.data || []).find((p: any) => p.auctionId === listingId);
      if (pickup) {
        await Promise.allSettled(
          Object.entries(files).map(async ([key, file]) => {
            if (!file || !COMP_TYPE_MAP[key]) return;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('type', COMP_TYPE_MAP[key]);
            await api.post(`/pickups/${pickup.id}/documents`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          }),
        );
        if (pickupDate) {
          await api.patch(`/pickups/${pickup.id}/schedule`, { scheduledDate: pickupDate });
        }
      }
      await fetchAllData();
    } catch (error) {
      console.error('Failed to submit compliance docs via API, updating locally', error);
    }
    setState(prev => ({
      ...prev,
      listings: prev.listings.map(l => l.id === listingId ? {
        ...l, complianceStatus: 'documents_uploaded',
      } : l),
    }));
  };

  const verifyCompliance = async (listingId: string) => {
    try {
      // Find the pickup for this auction/listing and complete it
      const pickupsRes = await api.get('/pickups');
      const pickup = (pickupsRes.data || []).find((p: any) => p.auctionId === listingId);
      if (pickup) {
        await api.patch(`/pickups/${pickup.id}/complete`);
      }
      await fetchAllData();
    } catch (error) {
      console.error('Failed to verify compliance via API, updating locally', error);
      setState(prev => ({
        ...prev,
        listings: prev.listings.map(l => l.id === listingId ? {
          ...l, complianceStatus: 'verified', status: 'completed',
        } : l),
      }));
    }
  };

  const rateVendor = async (listingId: string, vendorId: string, vendorName: string, overall: number, auditR: number, timelinessR: number, complianceR: number, comment: string) => {
    try {
      await api.patch(`/companies/${vendorId}/rating`, { rating: overall });
    } catch (error) {
      console.error('Failed to rate vendor via API', error);
    }
    // Always update local state for immediate UI feedback
    setState(prev => {
      const client = prev.currentUser;
      if (!client) return prev;
      const newRating: VendorRating = {
        id: `RV${Date.now()}`,
        listingId, vendorId, vendorName,
        clientId: client.id, clientName: client.name,
        overallRating: overall,
        auditRating: auditR,
        timelinessRating: timelinessR,
        complianceRating: complianceR,
        comment,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, vendorRatings: [...(prev.vendorRatings || []), newRating] };
    });
  };

  return (
    <AppContext.Provider value={{
      ...state,
      refreshData: fetchAllData,
      login, logout, register, startOnboarding,
      saveOnboardingProfile, saveOnboardingDocuments, saveOnboardingBankDetails, completeOnboarding,
      addListing, addBid, updateListingStatus, updateAuctionPhase, updateBidStatus, updateUserStatus, assignVendor,
      uploadProcessedSheet, approveRequirement,
      acceptBid, addNotification, markNotificationRead, markAllNotificationsRead, editListing, editBid,
      respondToInvitation, transitionAuctionPhase, addClosingDocument,
      updateUserProfile, changePassword, deleteAccount,
      auditInvitations: state.auditInvitations ?? [],
      sendAuditInvitations, respondToAuditInvitation, completeAudit,
      issuePO, acknowledgePO,
      submitEMD, verifyEMD,
      submitPaymentProof, confirmPayment,
      createHandoverDocs, acknowledgeHandover,
      submitReconciliation, verifyReconciliation,
      submitComplianceDocs, verifyCompliance,
      vendorRatings: state.vendorRatings ?? [],
      rateVendor,
      isSidebarOpen: state.isSidebarOpen ?? false,
      setIsSidebarOpen: (open: boolean) => setState(prev => ({ ...prev, isSidebarOpen: open })),
      isSidebarCollapsed: state.isSidebarCollapsed ?? false,
      setIsSidebarCollapsed: (collapsed: boolean) => setState(prev => ({ ...prev, isSidebarCollapsed: collapsed })),
      theme: state.theme ?? 'light',
      toggleTheme,
      isInitialized,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
