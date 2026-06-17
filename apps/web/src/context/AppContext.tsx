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
      maximumTickSize: req.auction?.maximumTickSize,
      extensionTime: req.auction?.extensionMinutes ?? req.auction?.extensionTime,
      maxExtensions: req.auction?.maxTicks ?? req.auction?.maxExtensions,
      highestEmdAmount: req.auction?.highestEmdAmount || 0,
      invitedVendorIds: Array.isArray(req.invitedVendorIds) ? req.invitedVendorIds : (typeof req.invitedVendorIds === 'string' ? JSON.parse(req.invitedVendorIds) : []),
      acceptedVendorIds: Array.isArray(req.acceptedVendorIds) ? req.acceptedVendorIds : (typeof req.acceptedVendorIds === 'string' ? JSON.parse(req.acceptedVendorIds) : []),
      declinedVendorIds: Array.isArray(req.declinedVendorIds) ? req.declinedVendorIds : (typeof req.declinedVendorIds === 'string' ? JSON.parse(req.declinedVendorIds) : []),
      auditApprovedVendorIds: Array.isArray(req.auditApprovedVendorIds) ? req.auditApprovedVendorIds : (typeof req.auditApprovedVendorIds === 'string' ? JSON.parse(req.auditApprovedVendorIds) : []),
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
        cpcbNo: u.company.cpcbNo || '',
        processingCapacity: u.company.processingCapacity || '',
        companyRegistrationNo: u.company.companyRegistrationNo || '',
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
      
      // Recovery logic: some bids might be nested in the auctions response but missing from the global bids response
      const nestedBids: any[] = [];
      if (Array.isArray(auctionsRes.data)) {
        auctionsRes.data.forEach((a: any) => {
          if (Array.isArray(a.bids)) {
            a.bids.forEach((nb: any) => {
              nestedBids.push({ ...nb, auctionId: a.id, auction: a });
            });
          }
        });
      }

      const combinedBidsRaw = [...backendBidsRaw];
      const existingBidIds = new Set(combinedBidsRaw.map(b => b.id));
      nestedBids.forEach(nb => {
        if (!existingBidIds.has(nb.id)) {
          combinedBidsRaw.push(nb);
          existingBidIds.add(nb.id);
        }
      });

      const backendBids = combinedBidsRaw.map((b: any) => {
        const status = b.status || (b.auction?.winnerId && (b.vendorId === b.auction.winnerId || b.vendor?.companyId === b.auction.winnerId) ? 'accepted' : 'pending');
        return {
          ...b,
          vendorName: b.vendorName || b.vendor?.name || b.vendor?.company?.name || 'Unknown Vendor',
          status,
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

        return {
          ...prev,
          listings: mergedListings,
          bids: backendBids.length > 0 ? backendBids : prev.bids,
          users: hasBackendUsers ? backendUsers : prev.users,
          auditInvitations: backendAudits.length > 0 ? backendAudits : prev.auditInvitations,
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
