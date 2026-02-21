import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  Chip, Alert, Snackbar, CircularProgress, Divider, Switch,
  FormControlLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import {
  Campaign, Visibility, TrendingUp, People, Star,
  AccountBalanceWallet, Refresh, BarChart as BarChartIcon, Payment,
  ArrowForward, Info
} from '@mui/icons-material';
import { db, auth } from '../firebase';
import {
  collection, getDocs, updateDoc, addDoc, doc, getDoc, query, where, orderBy,
  serverTimestamp, limit, increment
} from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const PRIORITY_PLANS = [
  { level: 1, label: '기본', desc: '스폰서 기본 노출', price: 10000, weight: 1 },
  { level: 2, label: '프리미엄', desc: '2배 노출 가중치', price: 30000, weight: 2 },
  { level: 3, label: 'VIP', desc: '3배 노출 가중치', price: 50000, weight: 3 },
];

export default function OwnerSponsorManage() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [walletBalance, setWalletBalance] = useState(0);

  const [sponsorStats, setSponsorStats] = useState({
    totalExposures: 0, totalClicks: 0, totalVisitsFromRoulette: 0,
    totalBonusGiven: 0, ctr: 0, conversionRate: 0,
  });
  const [settings, setSettings] = useState({
    bonusPointsPerVisit: 0,      // 사장님 보너스 (그대로)
    bonusPointsActive: false,     // 사장님 보너스 활성화 (그대로)
    sponsorBonusPoints: 0,        // ★ 스폰서 보너스 (새 필드)
    sponsorBonusActive: false,    // ★ 스폰서 보너스 활성화
    priorityLevel: 0,
    sponsorActive: false,
    isExpired: false,
  });

  const [settingsChanged, setSettingsChanged] = useState(false);

  const [exposureChartData, setExposureChartData] = useState([]);
  const [recentVisitors, setRecentVisitors] = useState([]);

  const [levelDialog, setLevelDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [levelProcessing, setLevelProcessing] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => { loadSponsorStores(); loadWallet(); }, []);

  useEffect(() => {
    if (selectedStore) loadSponsorData(selectedStore);
  }, [startDate, endDate]);

  const loadWallet = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const snap = await getDoc(doc(db, 'ownerWallets', uid));
      if (snap.exists()) setWalletBalance(snap.data().balance || 0);
    } catch (e) {}
  };

  const loadSponsorStores = async () => {
    setLoading(true);
    try {
      const userEmail = auth.currentUser?.email || '';
      const q = query(
        collection(db, 'ownerStores'),
        where('ownerEmail', '==', userEmail),
        where('sponsorStatus', '==', 'approved')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStores(list);
      if (list.length > 0) {
        setSelectedStore(list[0]);
        await loadSponsorData(list[0]);
      }
    } catch (error) {
      console.error('스폰서 가게 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSponsorData = async (store) => {
    if (!store) return;
    try {
      const storeId = String(store.kakaoPlaceId || store.id);

      // 활성 판단: sponsorActivatedAt이 있고 priorityLevel > 0이면 활성
      const hasActivated = !!(store.sponsorActivatedAt);
      const hasLevel = (store.priorityLevel || 0) > 0;
            let isExpired = false;
      if (store.sponsorExpiresAt) {
        const expiresAt = store.sponsorExpiresAt.toDate
          ? store.sponsorExpiresAt.toDate()
          : new Date(store.sponsorExpiresAt);
        isExpired = expiresAt < new Date();
      }
      const isActive = hasActivated && hasLevel && !isExpired;
      setSettings({
        bonusPointsPerVisit: store.bonusPointsPerVisit || 0,
        bonusPointsActive: store.bonusPointsActive || false,
        sponsorBonusPoints: store.sponsorBonusPoints || 0,         // ★
        sponsorBonusActive: store.sponsorBonusActive !== false,     // ★
        priorityLevel: store.priorityLevel || 0,
        sponsorActive: isActive,
        isExpired: isExpired,
      });

      let exposures = [], clicks = [], visits = [];

      try {
        const expSnap = await getDocs(query(collection(db, 'rouletteAppearances'), where('restaurantId', '==', storeId)));
        exposures = expSnap.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }));
      } catch (e) {}

      try {
        const clickSnap = await getDocs(query(collection(db, 'rouletteSelections'), where('restaurantId', '==', storeId)));
        clicks = clickSnap.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }));
      } catch (e) {}

      try {
        const vSnap = await getDocs(query(collection(db, 'visits'), where('restaurantId', '==', storeId), orderBy('createdAt', 'desc'), limit(100)));
        visits = vSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }));
      } catch (e) {}

      const bonusTotal = store.totalBonusGiven || 0;
      const totalExposures = exposures.length;
      const totalClicks = clicks.length;
      const totalVisits = visits.length;
      const ctr = totalExposures > 0 ? ((totalClicks / totalExposures) * 100).toFixed(1) : 0;
      const conversionRate = totalClicks > 0 ? ((totalVisits / totalClicks) * 100).toFixed(1) : 0;

      setSponsorStats({
        totalExposures, totalClicks, totalVisitsFromRoulette: totalVisits,
        totalBonusGiven: bonusTotal, ctr: Number(ctr), conversionRate: Number(conversionRate),
      });

      buildExposureChart(exposures, clicks, visits);
      setRecentVisitors(visits.slice(0, 10));
    } catch (error) {
      console.error('스폰서 데이터 로드 실패:', error);
    }
  };

  const buildExposureChart = (exposures, clicks, visits) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const data = [];
    for (let i = 0; i < diffDays && i < 31; i++) {
      const date = new Date(start); date.setDate(date.getDate() + i); date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + 1);
      const inRange = (d) => { const t = new Date(d); return t >= date && t < nextDate; };
      data.push({
        name: `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`,
        노출: exposures.filter(e => inRange(e.createdAt)).length,
        클릭: clicks.filter(c => inRange(c.createdAt)).length,
        방문: visits.filter(v => inRange(v.createdAt)).length,
      });
    }
    setExposureChartData(data);
  };

  const handleSaveSettings = async () => {
    if (!selectedStore) return;
    try {
      await updateDoc(doc(db, 'ownerStores', selectedStore.id), {
        // ★ 스폰서 보너스 전용 필드
        sponsorBonusPoints: settings.sponsorBonusPoints,
        sponsorBonusActive: settings.sponsorBonusActive,
        updatedAt: serverTimestamp(),
      });
      setSettingsChanged(false);
      setSnackbar({ open: true, message: '스폰서 보너스 설정이 저장되었습니다.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '설정 저장 실패', severity: 'error' });
    }
  };

  const handleLevelChange = async () => {
    if (!selectedStore || !selectedPlan) return;
    setLevelProcessing(true);
    try {
      const uid = auth.currentUser?.uid;
      const walletRef = doc(db, 'ownerWallets', uid);
      const walletSnap = await getDoc(walletRef);
      const balance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;

      if (balance < selectedPlan.price) {
        setSnackbar({ open: true, message: `잔액 부족. 필요: ${selectedPlan.price.toLocaleString()}P / 잔액: ${balance.toLocaleString()}P`, severity: 'error' });
        setLevelProcessing(false);
        return;
      }

      await updateDoc(walletRef, {
        balance: increment(-selectedPlan.price),
        totalUsed: increment(selectedPlan.price),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'ownerStores', selectedStore.id), {
        priorityLevel: selectedPlan.level,
        priorityWeight: selectedPlan.weight,
        isSponsored: true,
        sponsorActivatedAt: serverTimestamp(),
        sponsorExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'sponsorLevelPayments'), {
        storeId: selectedStore.id, storeName: selectedStore.name,
        ownerId: uid, ownerEmail: auth.currentUser?.email || '',
        previousLevel: settings.priorityLevel, newLevel: selectedPlan.level,
        planLabel: selectedPlan.label, price: selectedPlan.price, weight: selectedPlan.weight,
        paidAt: serverTimestamp(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await addDoc(collection(db, 'walletTransactions'), {
        ownerId: uid, ownerEmail: auth.currentUser?.email || '',
        type: 'sponsor_level', description: `스폰서 ${selectedPlan.label} 플랜 (${selectedStore.name})`,
        storeName: selectedStore.name, amount: -selectedPlan.price, createdAt: serverTimestamp(),
      });

      setSettings({ ...settings, priorityLevel: selectedPlan.level, sponsorActive: true });
      setWalletBalance(balance - selectedPlan.price);
      setLevelDialog(false);
      setSnackbar({ open: true, message: `${selectedPlan.label} 플랜 결제 완료! 지금부터 스폰서가 활성화됩니다.`, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '레벨 변경 실패: ' + error.message, severity: 'error' });
    } finally {
      setLevelProcessing(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const currentPlan = PRIORITY_PLANS.find(p => p.level === settings.priorityLevel) || null;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><CircularProgress sx={{ color: '#FF6B6B' }} /></Box>;
  }

  if (stores.length === 0) {
    return (
      <Box>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>스폰서 매장 관리</Typography>
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Campaign sx={{ fontSize: 64, color: '#DDD', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>승인된 스폰서 매장이 없습니다</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            스폰서 신청이 승인되면 이곳에서 노출 레벨을 선택하고 통계를 관리할 수 있습니다.
          </Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">스폰서 매장 관리</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>스폰서 혜택 현황과 노출 통계를 확인하세요</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {stores.length > 1 && stores.map((s) => (
            <Chip key={s.id} label={s.name}
              onClick={() => { setSelectedStore(s); loadSponsorData(s); }}
              color={selectedStore?.id === s.id ? 'primary' : 'default'}
              variant={selectedStore?.id === s.id ? 'filled' : 'outlined'} />
          ))}
          <Button startIcon={<Refresh />} onClick={() => { loadSponsorStores(); loadWallet(); }} variant="outlined" size="small">새로고침</Button>
        </Box>
      </Box>

      {/* 스폰서 미활성 안내 */}
      {!settings.sponsorActive && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} icon={<Info />}>
          <strong>스폰서가 아직 활성화되지 않았습니다.</strong> 아래에서 노출 레벨을 선택하고 결제하면 즉시 스폰서가 활성화됩니다.
          레벨 결제 전까지는 일반 매장과 동일하게 노출됩니다.
        </Alert>
      )}

            {/* 스폰서 만료 안내 */}
      {settings.isExpired && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>스폰서 기간이 만료되었습니다.</strong> 아래에서 노출 레벨을 다시 결제하면 즉시 재활성화됩니다.
        </Alert>
      )}

      {/* 상태 배너 */}
      <Card sx={{
        mb: 3, borderRadius: 3, p: 3,
        background: settings.sponsorActive ? 'linear-gradient(135deg, #FF6B6B 0%, #FF9800 100%)' : 'linear-gradient(135deg, #666 0%, #444 100%)',
        color: '#FFF'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Campaign sx={{ fontSize: 28 }} />
              <Typography variant="h6" fontWeight="bold">{selectedStore?.name}</Typography>
              <Chip
                label={settings.sponsorActive ? `${currentPlan?.label || ''} 플랜 활성` : '승인됨 · 레벨 선택 대기'}
                size="small" sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: '#FFF' }} />
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {selectedStore?.address}
              {settings.sponsorActive && currentPlan && ` | 가중치 x${currentPlan.weight}`}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>통합 지갑 잔액</Typography>
            <Typography variant="h4" fontWeight="bold">{walletBalance.toLocaleString()}P</Typography>
          </Box>
        </Box>
      </Card>

      {/* 우선 노출 레벨 */}
      <Card sx={{ p: 3, mb: 3, borderRadius: 3, border: !settings.sponsorActive ? '2px solid #FF9800' : 'none' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">우선 노출 레벨</Typography>
          {!settings.sponsorActive && <Chip label="레벨 선택 필요" color="warning" size="small" />}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          높은 레벨일수록 룰렛에서 더 자주 노출됩니다. <strong>결제 시점부터 스폰서가 활성화</strong>됩니다.
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {PRIORITY_PLANS.map((plan) => {
            // 현재 플랜: sponsorActive이고 level이 같을 때만
            const isCurrent = settings.sponsorActive && settings.priorityLevel === plan.level;
            return (
              <Grid item xs={12} md={4} key={plan.level}>
                <Card
                  sx={{
                    p: 3, textAlign: 'center', cursor: isCurrent ? 'default' : 'pointer',
                    border: isCurrent ? '2px solid #FF6B6B' : '1px solid #EEE',
                    bgcolor: isCurrent ? '#FFF5F5' : '#FFF',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#FF6B6B', transform: isCurrent ? 'none' : 'translateY(-2px)', boxShadow: isCurrent ? 'none' : '0 4px 12px rgba(0,0,0,0.1)' },
                  }}
                  onClick={() => { if (!isCurrent) { setSelectedPlan(plan); setLevelDialog(true); } }}
                >
                  {isCurrent && <Chip label="현재 플랜" color="primary" size="small" sx={{ mb: 1 }} />}
                  <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>{plan.label}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{plan.desc}</Typography>
                  <Typography variant="h4" fontWeight="bold" color="#FF6B6B">{plan.price.toLocaleString()}P</Typography>
                  <Typography variant="caption" color="text.secondary">/ 월</Typography>
                  <Box sx={{ mt: 1.5 }}><Chip label={`가중치 x${plan.weight}`} size="small" variant="outlined" /></Box>
                  {!isCurrent && (
                    <Button variant="outlined" size="small" sx={{ mt: 2 }} startIcon={<Payment />}>
                      {settings.sponsorActive ? '변경하기' : '선택 및 결제'}
                    </Button>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Card>

      {/* 활성화된 경우에만 통계 + 보너스 설정 표시 */}
      {settings.sponsorActive && (
        <>
          {/* 핵심 통계 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { icon: <Visibility sx={{ fontSize: 32, color: '#9C27B0' }} />, value: sponsorStats.totalExposures.toLocaleString(), label: '룰렛 노출' },
              { icon: <TrendingUp sx={{ fontSize: 32, color: '#2196F3' }} />, value: sponsorStats.totalClicks.toLocaleString(), label: '룰렛 선택' },
              { icon: <People sx={{ fontSize: 32, color: '#4CAF50' }} />, value: sponsorStats.totalVisitsFromRoulette.toLocaleString(), label: '방문 인증' },
              { icon: <Star sx={{ fontSize: 32, color: '#FF9800' }} />, value: `${sponsorStats.ctr}%`, label: '클릭률 (CTR)' },
              { icon: <AccountBalanceWallet sx={{ fontSize: 32, color: '#FF6B6B' }} />, value: `${sponsorStats.totalBonusGiven.toLocaleString()}P`, label: '총 보너스 지급' },
            ].map((stat, i) => (
              <Grid item xs={12} sm={6} md={2.4} key={i}>
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    {stat.icon}
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{stat.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* 전환 퍼널 */}
          <Card sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>전환 퍼널</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ flex: 1, textAlign: 'center', py: 3, px: 2, bgcolor: '#F3E5F5', borderRadius: '16px 0 0 16px' }}>
                <Visibility sx={{ fontSize: 40, color: '#9C27B0', mb: 1 }} />
                <Typography variant="h3" fontWeight="bold" color="#9C27B0">{sponsorStats.totalExposures.toLocaleString()}</Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>룰렛 노출</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, minWidth: 80, zIndex: 1 }}>
                <Box sx={{ bgcolor: '#2196F3', color: '#FFF', borderRadius: 2, px: 1.5, py: 0.5, mb: 0.5, fontSize: 13, fontWeight: 700 }}>{sponsorStats.ctr}%</Box>
                <ArrowForward sx={{ fontSize: 32, color: '#2196F3' }} />
                <Typography variant="caption" color="text.secondary">클릭률</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center', py: 3, px: 2, bgcolor: '#E3F2FD' }}>
                <TrendingUp sx={{ fontSize: 40, color: '#2196F3', mb: 1 }} />
                <Typography variant="h3" fontWeight="bold" color="#2196F3">{sponsorStats.totalClicks.toLocaleString()}</Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>클릭 (선택)</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, minWidth: 80, zIndex: 1 }}>
                <Box sx={{ bgcolor: '#4CAF50', color: '#FFF', borderRadius: 2, px: 1.5, py: 0.5, mb: 0.5, fontSize: 13, fontWeight: 700 }}>{sponsorStats.conversionRate}%</Box>
                <ArrowForward sx={{ fontSize: 32, color: '#4CAF50' }} />
                <Typography variant="caption" color="text.secondary">전환율</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center', py: 3, px: 2, bgcolor: '#E8F5E9', borderRadius: '0 16px 16px 0' }}>
                <People sx={{ fontSize: 40, color: '#4CAF50', mb: 1 }} />
                <Typography variant="h3" fontWeight="bold" color="#4CAF50">{sponsorStats.totalVisitsFromRoulette.toLocaleString()}</Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>방문 인증</Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 3, p: 2, bgcolor: '#F5F6FA', borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={4} sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">노출 대비 클릭</Typography>
                  <Typography variant="h6" fontWeight="bold" color="#2196F3">{sponsorStats.ctr}%</Typography>
                  <Typography variant="caption" color="text.secondary">{sponsorStats.totalExposures}회 노출 → {sponsorStats.totalClicks}회 클릭</Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">클릭 대비 방문</Typography>
                  <Typography variant="h6" fontWeight="bold" color="#4CAF50">{sponsorStats.conversionRate}%</Typography>
                  <Typography variant="caption" color="text.secondary">{sponsorStats.totalClicks}회 클릭 → {sponsorStats.totalVisitsFromRoulette}회 방문</Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">스폰서 보너스</Typography>
                  <Typography variant="h6" fontWeight="bold" color="#FF6B6B">
                    {settings.sponsorBonusPoints > 0 ? `${settings.sponsorBonusPoints.toLocaleString()}P` : '미설정'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">총 {sponsorStats.totalBonusGiven.toLocaleString()}P 지급</Typography>
                </Grid>
              </Grid>
            </Box>
          </Card>

          {/* 일별 그래프 */}
          <Card sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold"><BarChartIcon sx={{ verticalAlign: 'middle', mr: 1 }} />일별 추이</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField type="date" size="small" value={startDate} onChange={(e) => setStartDate(e.target.value)} sx={{ width: 150 }} />
                <Typography variant="body2">~</Typography>
                <TextField type="date" size="small" value={endDate} onChange={(e) => setEndDate(e.target.value)} sx={{ width: 150 }} />
                <Button size="small" variant="outlined" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 6); setStartDate(d.toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]); }}>7일</Button>
                <Button size="small" variant="outlined" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 29); setStartDate(d.toISOString().split('T')[0]); setEndDate(new Date().toISOString().split('T')[0]); }}>30일</Button>
              </Box>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={exposureChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip /><Legend />
                <Bar dataKey="노출" fill="#9C27B0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="클릭" fill="#2196F3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="방문" fill="#4CAF50" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 스폰서 보너스 설정 */}
          <Card sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>스폰서 보너스 설정</Typography>

            <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#F8F9FA', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Info sx={{ color: '#FF9800', mt: 0.3 }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: '#FF9800' }}>
                    스폰서 보너스란?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    스폰서 보너스는 <strong>스폰서 매장만의 특별 혜택</strong>입니다.
                    일반 방문 포인트(앱 기본 지급)와는 별도로, 스폰서 매장을 방문한 고객에게 <strong>추가 보너스</strong>를 지급합니다.
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    <strong>일반 방문 포인트</strong> — 앱이 모든 매장 방문 인증 시 기본 지급 (사장님 비용 없음)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    <strong>스폰서 보너스</strong> — 스폰서 매장 방문 시 <strong>추가로</strong> 지급 (사장님 지갑에서 차감)
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    예: 일반 포인트 100P + 스폰서 보너스 500P = 고객이 총 600P 획득
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    → 고객 입장에서 스폰서 매장이 더 매력적으로 보임 → 재방문율 UP
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    💡 스폰서 보너스가 설정되면 앱의 맛집카드에 "보너스 +500P" 같은 뱃지가 표시되어 고객의 선택을 유도합니다.
                  </Typography>
                </Box>
              </Box>
            </Card>

            <FormControlLabel
              control={<Switch checked={settings.sponsorBonusActive}
                onChange={(e) => { setSettings({ ...settings, sponsorBonusActive: e.target.checked }); setSettingsChanged(true); }}
                color="success" />}
              label={settings.sponsorBonusActive ? '스폰서 보너스 활성화' : '스폰서 보너스 비활성화'}
              sx={{ mb: 2, display: 'block' }}
            />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>방문당 스폰서 보너스</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {[100, 200, 300, 500, 1000, 2000, 3000].map((v) => (
                <Chip key={v} label={`${v.toLocaleString()}P`}
                  onClick={() => { setSettings({ ...settings, sponsorBonusPoints: v }); setSettingsChanged(true); }}
                  color={settings.sponsorBonusPoints === v ? 'primary' : 'default'}
                  variant={settings.sponsorBonusPoints === v ? 'filled' : 'outlined'} />
              ))}
            </Box>

            <TextField label="직접 입력" type="number" size="small" value={settings.sponsorBonusPoints}
              onChange={(e) => { setSettings({ ...settings, sponsorBonusPoints: parseInt(e.target.value) || 0 }); setSettingsChanged(true); }}
              sx={{ width: 200, mb: 2 }}
              InputProps={{ endAdornment: <Typography color="text.secondary">P</Typography> }} />

            {settings.sponsorBonusPoints > 0 && walletBalance > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                지갑 잔액({walletBalance.toLocaleString()}P)으로 약 <strong>{Math.floor(walletBalance / settings.sponsorBonusPoints)}명</strong>에게 스폰서 보너스 지급 가능
              </Alert>
            )}

            {walletBalance <= 0 && settings.sponsorBonusActive && (
              <Alert severity="warning" sx={{ mb: 2 }}>지갑 잔액이 0입니다. 포인트 충전 후 보너스가 지급됩니다.</Alert>
            )}

            <Button variant="contained" onClick={handleSaveSettings} disabled={!settingsChanged}
              sx={{ bgcolor: '#FF6B6B', '&:hover': { bgcolor: '#FF4757' } }}>설정 저장</Button>
          </Card>

          {/* 최근 방문자 */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}><People sx={{ verticalAlign: 'middle', mr: 1 }} />최근 방문 인증</Typography>
              {recentVisitors.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>아직 방문 인증 내역이 없습니다</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead><TableRow sx={{ bgcolor: '#F5F6FA' }}>
                      <TableCell><strong>방문자</strong></TableCell>
                      <TableCell><strong>날짜</strong></TableCell>
                      <TableCell><strong>스폰서 보너스</strong></TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {recentVisitors.map((v) => (
                        <TableRow key={v.id} hover>
                          <TableCell>{v.userName || v.userEmail || '-'}</TableCell>
                          <TableCell>{formatDate(v.createdAt)}</TableCell>
                          <TableCell><Chip label={`+${(v.bonusPoints || settings.sponsorBonusPoints || 0).toLocaleString()}P`} size="small" color="success" variant="outlined" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 레벨 변경 다이얼로그 */}
      <Dialog open={levelDialog} onClose={() => !levelProcessing && setLevelDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{settings.sponsorActive ? '노출 레벨 변경' : '스폰서 활성화'}</DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <Box sx={{ py: 1 }}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight="bold">{selectedPlan.label} 플랜</Typography>
                <Typography variant="body2" color="text.secondary">{selectedPlan.desc}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#F5F5F5', borderRadius: 2, p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>월 비용</Typography>
                  <Typography fontWeight={600} color="primary">{selectedPlan.price.toLocaleString()}P</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>노출 가중치</Typography>
                  <Typography fontWeight={600}>x{selectedPlan.weight}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>현재 지갑 잔액</Typography>
                  <Typography fontWeight={600} color={walletBalance >= selectedPlan.price ? '#4CAF50' : '#F44336'}>{walletBalance.toLocaleString()}P</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>결제 후 잔액</Typography>
                  <Typography fontWeight={600}>{(walletBalance - selectedPlan.price).toLocaleString()}P</Typography>
                </Box>
              </Box>
              {walletBalance < selectedPlan.price ? (
                <Alert severity="error">잔액이 부족합니다. "포인트 충전" 메뉴에서 충전 후 다시 시도해주세요.</Alert>
              ) : (
                <Alert severity="info">
                  {settings.sponsorActive ? '결제 즉시 레벨이 변경됩니다. 30일간 유효합니다.' : '결제 즉시 스폰서가 활성화되고 룰렛에서 우선 노출이 시작됩니다.'}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLevelDialog(false)} disabled={levelProcessing}>취소</Button>
          <Button variant="contained" onClick={handleLevelChange}
            disabled={levelProcessing || walletBalance < (selectedPlan?.price || 0)}
            startIcon={levelProcessing ? <CircularProgress size={18} /> : <Payment />}
            sx={{ bgcolor: '#FF6B6B' }}>
            {levelProcessing ? '처리 중...' : settings.sponsorActive ? '결제 및 변경' : '결제 및 활성화'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
