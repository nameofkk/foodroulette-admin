import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  CssBaseline, Box, Drawer, List, ListItem, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Chip, Divider, Badge, CircularProgress
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleIcon from '@mui/icons-material/People';
import ReviewsIcon from '@mui/icons-material/RateReview';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StoreMallDirectoryIcon from '@mui/icons-material/StoreMallDirectory';
import StoreIcon from '@mui/icons-material/Store';
import LogoutIcon from '@mui/icons-material/Logout';
import ChatIcon from '@mui/icons-material/Chat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

import Dashboard from './pages/Dashboard';
import SponsorApplications from './pages/SponsorApplications';
import SponsorManage from './pages/SponsorManage';
import Users from './pages/Users';
import Reviews from './pages/Reviews';
import Products from './pages/Products';
import Orders from './pages/Orders';
import OwnerDashboard from './pages/OwnerDashboard';
import ChargeManage from './pages/ChargeManage';
import OwnerMyStore from './pages/OwnerMyStore';
import Login from './pages/Login';
import InquiryManage from './pages/InquiryManage';
import OwnerBonus from './pages/OwnerBonus';
import OwnerSponsorManage from './pages/OwnerSponsorManage';
import OwnerWallet from './pages/OwnerWallet';

const drawerWidth = 260;

const theme = createTheme({
  palette: {
    primary: { main: '#FF6B6B' },
    secondary: { main: '#FF9800' },
    background: { default: '#F5F6FA' },
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
  },
});

const adminMenuItems = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/' },
  { text: '스폰서 신청 관리', icon: <CampaignIcon />, path: '/sponsor-applications' },
  { text: '스폰서 맛집 관리', icon: <StorefrontIcon />, path: '/sponsor-manage' },
  { text: '사용자 관리', icon: <PeopleIcon />, path: '/users' },
  { text: '리뷰 관리', icon: <ReviewsIcon />, path: '/reviews' },
  { text: '포인트 상품', icon: <CardGiftcardIcon />, path: '/products' },
  { text: '주문 관리', icon: <ShoppingCartIcon />, path: '/orders' },
  { text: '문의 관리', icon: <ChatIcon />, path: '/inquiries' },
  { text: '충전 관리', icon: <ShoppingCartIcon />, path: '/charges' },
];

const ownerMenuItems = [
  { text: '사장님 대시보드', icon: <StoreMallDirectoryIcon />, path: '/owner' },
  { text: '내 가게 관리', icon: <StoreIcon />, path: '/owner-store' },
  { text: '스폰서 매장 관리', icon: <TrendingUpIcon />, path: '/owner-sponsor' },
  { text: '보너스 포인트 관리', icon: <CardGiftcardIcon />, path: '/owner-bonus' },
  { text: '포인트 충전', icon: <AccountBalanceWalletIcon />, path: '/owner-wallet' },
];

function Sidebar({ role, pendingApplications }) {
  const location = useLocation();

  const renderMenu = (items, label) => (
    <>
      {label && (
        <Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />
          <Typography variant="caption" sx={{ px: 2, color: '#666', fontWeight: 600 }}>
            {label}
          </Typography>
        </Box>
      )}
      {items.map((item) => (
        <ListItem
          button
          key={item.text}
          component={Link}
          to={item.path}
          sx={{
            borderRadius: 2, mb: 0.5, color: '#AAA',
            bgcolor: location.pathname === item.path ? 'rgba(255,107,107,0.15)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(255,107,107,0.1)' },
            ...(location.pathname === item.path && { color: '#FF6B6B' }),
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
            {item.text === '스폰서 신청 관리' && pendingApplications > 0 ? (
              <Badge badgeContent={pendingApplications} color="error">{item.icon}</Badge>
            ) : item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            primaryTypographyProps={{
              fontWeight: location.pathname === item.path ? 700 : 400,
            }}
          />
        </ListItem>
      ))}
    </>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        '& .MuiDrawer-paper': {
          width: drawerWidth, boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #2C2C3E 0%, #1A1A2E 100%)',
          color: '#FFF', borderRight: 'none',
        },
      }}
    >
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#FF6B6B' }}>
          🎰 FoodRoulette
        </Typography>
        <Chip
          label={role === 'admin' ? 'Admin' : '사장님'}
          size="small"
          sx={{ mt: 1, bgcolor: role === 'admin' ? '#FF6B6B' : '#FF9800', color: '#FFF' }}
        />
      </Box>
      <List sx={{ px: 1 }}>
        {role === 'admin' && renderMenu(adminMenuItems)}
        {role === 'admin' && renderMenu(ownerMenuItems, '사장님')}
        {role === 'owner' && renderMenu(ownerMenuItems)}
      </List>
    </Drawer>
  );
}

function AdminLayout({ onLogout, role, pendingApplications, storeId, ownerId }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar role={role} pendingApplications={pendingApplications} />
      <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: '#FFF', color: '#333' }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
              {role === 'admin' ? 'FoodRoulette 관리자' : 'FoodRoulette 사장님'}
            </Typography>
            <IconButton onClick={onLogout} color="inherit">
              <LogoutIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 3 }}>
          <Routes>
            {role === 'admin' && (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sponsor-applications" element={<SponsorApplications />} />
                <Route path="/sponsor-manage" element={<SponsorManage />} />
                <Route path="/users" element={<Users />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/products" element={<Products />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/inquiries" element={<InquiryManage />} />
                <Route path="/charges" element={<ChargeManage />} />
              </>
            )}
            <Route path="/owner" element={<OwnerDashboard role={role} />} />
            <Route path="/owner-store" element={<OwnerMyStore role={role} />} />
            <Route path="/owner-sponsor" element={<OwnerSponsorManage />} />
            <Route path="/owner-bonus" element={<OwnerBonus storeId={storeId} ownerId={ownerId} />} />
            <Route path="/owner-wallet" element={<OwnerWallet />} />
            <Route path="*" element={role === 'admin' ? <Dashboard /> : <OwnerDashboard />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [ownerId, setOwnerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingApplications, setPendingApplications] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAccessDenied(false);
      if (u) {
        setOwnerId(u.uid);
        const userRole = await loadUserRole(u);
        if (userRole) {
          setRole(userRole);
          await loadOwnerStore(u.uid, u.email);
          if (userRole === 'admin') await loadPendingCount();
        } else {
          setAccessDenied(true);
          setRole(null);
        }
      } else {
        setRole(null);
        setStoreId(null);
        setOwnerId(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadUserRole = async (u) => {
    try {
      const snap = await getDoc(doc(db, 'adminUsers', u.uid));
      if (snap.exists()) return snap.data().role || 'owner';
      return null;
    } catch (error) {
      console.error('역할 로드 실패:', error);
      return null;
    }
  };

  const loadOwnerStore = async (uid, userEmail) => {
    try {
      const adminDoc = await getDoc(doc(db, 'adminUsers', uid));
      if (adminDoc.exists() && adminDoc.data().storeId) {
        setStoreId(adminDoc.data().storeId);
        return;
      }
      if (userEmail) {
        const q = query(collection(db, 'ownerStores'), where('ownerEmail', '==', userEmail));
        const snap = await getDocs(q);
        if (!snap.empty) { setStoreId(snap.docs[0].id); return; }
      }
      const q2 = query(collection(db, 'ownerStores'), where('ownerId', '==', uid));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) setStoreId(snap2.docs[0].id);
    } catch (error) {
      console.error('가게 정보 로드 실패:', error);
    }
  };

  const loadPendingCount = async () => {
    try {
      const q = query(collection(db, 'sponsorApplications'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      setPendingApplications(snap.size);
    } catch (error) {}
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAccessDenied(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 2 }}>
        <CircularProgress sx={{ color: '#FF6B6B' }} />
        <Typography>로딩 중...</Typography>
      </Box>
    );
  }

  if (accessDenied) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 2, bgcolor: '#1A1A2E', color: '#FFF' }}>
          <Typography variant="h4" sx={{ color: '#FF6B6B' }}>🚫</Typography>
          <Typography variant="h6">접근 권한이 없습니다</Typography>
          <Typography variant="body2" sx={{ color: '#999', textAlign: 'center' }}>
            이 계정은 관리 패널에 등록되지 않았습니다.<br />사장님이시라면 회원가입을 먼저 진행해주세요.
          </Typography>
          <button onClick={handleLogout} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', backgroundColor: '#FF6B6B', color: '#FFF', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
            로그아웃 후 다시 시도
          </button>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {user && role ? (
          <AdminLayout onLogout={handleLogout} role={role} pendingApplications={pendingApplications} storeId={storeId} ownerId={ownerId} />
        ) : (
          <Routes>
            <Route path="*" element={<Login />} />
          </Routes>
        )}
      </Router>
    </ThemeProvider>
  );
}
