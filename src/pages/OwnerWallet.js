import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField, Divider,
  Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Snackbar, CircularProgress, Grid
} from '@mui/material';
import {
  AccountBalanceWallet, Payment, History, Store, Search, TrendingUp, CardGiftcard, Star
} from '@mui/icons-material';
import { db, auth } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, getDocs, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp
} from 'firebase/firestore';

const CHARGE_OPTIONS = [
  { points: 10000, label: '1만P' },
  { points: 30000, label: '3만P' },
  { points: 50000, label: '5만P' },
  { points: 100000, label: '10만P' },
  { points: 200000, label: '20만P' },
  { points: 500000, label: '50만P' },
];

export default function OwnerWallet() {
  const [walletData, setWalletData] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chargeDialog, setChargeDialog] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [charging, setCharging] = useState(false);
  const [chargeHistory, setChargeHistory] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // ★ Firestore appConfig에서 동적으로 가져오는 값들
  const [feeRate, setFeeRate] = useState(0.20);
  const [bankInfo, setBankInfo] = useState({
    bankName: '',
    bankAccount: '',
    bankHolder: '',
  });

  // ─── useEffect: 마운트 시 전체 로딩 ───
  useEffect(() => {
    loadWallet();
    loadStores();
    loadAppConfig();
    const unsub = loadChargeHistory();
    const unsub2 = loadUsageHistory();
    return () => {
      if (typeof unsub === 'function') unsub();
      if (typeof unsub2 === 'function') unsub2();
    };
  }, []);

  // ─── appConfig 로드 (수수료율, 입금계좌) ───
  const loadAppConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'settings'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.feeRate !== undefined) setFeeRate(data.feeRate);
        if (data.bankName) {
          setBankInfo({
            bankName: data.bankName || '',
            bankAccount: data.bankAccount || '',
            bankHolder: data.bankHolder || '',
          });
        }
      }
    } catch (e) {
      console.log('appConfig 로드 실패 (기본값 사용):', e.message);
    }
  };

  // ─── 지갑 로드 ───
  const loadWallet = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const walletRef = doc(db, 'ownerWallets', uid);
      const snap = await getDoc(walletRef);

      if (snap.exists()) {
        setWalletData(snap.data());
      } else {
        const initial = {
          ownerEmail: auth.currentUser?.email || '',
          balance: 0,
          totalCharged: 0,
          totalUsed: 0,
          totalFee: 0,
          createdAt: serverTimestamp(),
        };
        await setDoc(walletRef, initial);
        setWalletData(initial);
      }
    } catch (e) {
      console.error('지갑 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  // ─── 가게 목록 로드 ───
  const loadStores = async () => {
    try {
      const userEmail = auth.currentUser?.email || '';
      const q = query(collection(db, 'ownerStores'), where('ownerEmail', '==', userEmail));
      const snap = await getDocs(q);
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('가게 로드 실패:', e);
    }
  };

  // ─── 충전 내역 실시간 구독 ───
  const loadChargeHistory = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return () => {};
    const q = query(
      collection(db, 'ownerCharges'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setChargeHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  // ─── 사용 내역 실시간 구독 ───
  const loadUsageHistory = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return () => {};
    const q = query(
      collection(db, 'walletTransactions'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setUsageHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      setUsageHistory([]);
    });
  };

  // ─── 충전 요청 ───
  const handleCharge = async () => {
    const points = selectedAmount || parseInt(customAmount);
    if (!points || points < 1000) {
      setSnackbar({ open: true, message: '최소 충전은 1,000P입니다.', severity: 'warning' });
      return;
    }

    setCharging(true);
    try {
      const fee = Math.round(points * feeRate);
      const totalPayment = points + fee;
      const uid = auth.currentUser?.uid;

      await addDoc(collection(db, 'ownerCharges'), {
        ownerId: uid,
        ownerEmail: auth.currentUser?.email || '',
        walletId: uid,
        points,
        fee,
        totalPayment,
        paymentMethod: 'manual',
        status: 'pending',
        isWalletCharge: true,
        createdAt: serverTimestamp(),
      });

      setSnackbar({
        open: true,
        message: `${points.toLocaleString()}P 충전 요청 완료. 입금 확인 후 승인되면 반영됩니다.`,
        severity: 'info',
      });
      setChargeDialog(false);
      setSelectedAmount(null);
      setCustomAmount('');
    } catch (e) {
      setSnackbar({ open: true, message: '충전 요청 실패', severity: 'error' });
    } finally {
      setCharging(false);
    }
  };

  // ─── 날짜 포맷 ───
  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // ─── 로딩 화면 ───
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress sx={{ color: '#FF6B6B' }} />
      </Box>
    );
  }

  const balance = walletData?.balance || 0;
  const totalCharged = walletData?.totalCharged || 0;
  const totalUsed = walletData?.totalUsed || 0;

  // ═══════════════════════════════════════
  // ─── 렌더 ───
  // ═══════════════════════════════════════
  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>포인트 충전</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        충전한 포인트는 내 모든 가게의 보너스 지급, 스폰서 레벨 비용 등에 공통으로 사용됩니다.
      </Typography>

      {/* 지갑 잔액 카드 */}
      <Card sx={{
        mb: 3, borderRadius: 3, p: 3,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#FFF'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AccountBalanceWallet sx={{ fontSize: 28 }} />
              <Typography variant="body1" sx={{ opacity: 0.9 }}>내 포인트 잔액</Typography>
            </Box>
            <Typography variant="h3" fontWeight="bold">{balance.toLocaleString()}P</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
              {auth.currentUser?.email} 계정의 통합 포인트
            </Typography>
          </Box>
          <Button variant="contained" size="large" startIcon={<Payment />}
            onClick={() => { setSelectedAmount(null); setCustomAmount(''); setChargeDialog(true); }}
            sx={{
              bgcolor: 'rgba(255,255,255,0.25)', color: '#FFF',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.4)' },
              fontSize: 16, px: 4, py: 1.5, borderRadius: 3,
            }}>
            충전하기
          </Button>
        </Box>
      </Card>

      {/* 요약 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUp sx={{ fontSize: 32, color: '#4CAF50' }} />
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{totalCharged.toLocaleString()}원</Typography>
              <Typography variant="body2" color="text.secondary">총 충전 금액</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <CardGiftcard sx={{ fontSize: 32, color: '#FF9800' }} />
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{totalUsed.toLocaleString()}P</Typography>
              <Typography variant="body2" color="text.secondary">총 사용 포인트</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Store sx={{ fontSize: 32, color: '#2196F3' }} />
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{stores.length}개</Typography>
              <Typography variant="body2" color="text.secondary">연결된 가게</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 연결된 가게 */}
      {stores.length > 0 && (
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>연결된 가게</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              아래 가게들이 모두 이 지갑의 포인트를 공유합니다.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {stores.map((s) => (
                <Chip key={s.id} label={s.name} variant="outlined"
                  icon={s.sponsorStatus === 'approved' ? <Star sx={{ color: '#FF9800 !important' }} /> : <Store />} />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 빠른 충전 */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">빠른 충전</Typography>
            <Chip label={`수수료 ${(feeRate * 100).toFixed(0)}%`} size="small" color="warning" />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {CHARGE_OPTIONS.map((opt) => {
              const fee = Math.round(opt.points * feeRate);
              const total = opt.points + fee;
              return (
                <Button key={opt.points} variant="outlined"
                  onClick={() => { setSelectedAmount(opt.points); setCustomAmount(''); setChargeDialog(true); }}
                  sx={{ flexDirection: 'column', py: 2, px: 3, borderRadius: 2, minWidth: 120 }}>
                  <Typography fontWeight={700} fontSize={16}>{opt.label}</Typography>
                  <Typography fontSize={11} color="text.secondary">결제 {total.toLocaleString()}원</Typography>
                </Button>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* 사용 내역 */}
      {usageHistory.length > 0 && (
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>포인트 사용 내역</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                    <TableCell><strong>날짜</strong></TableCell>
                    <TableCell><strong>내용</strong></TableCell>
                    <TableCell><strong>가게</strong></TableCell>
                    <TableCell><strong>포인트</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usageHistory.slice(0, 20).map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ fontSize: 13 }}>{formatDate(u.createdAt)}</TableCell>
                      <TableCell>{u.description || u.type || '-'}</TableCell>
                      <TableCell>{u.storeName || '-'}</TableCell>
                      <TableCell sx={{ color: u.amount > 0 ? '#4CAF50' : '#F44336', fontWeight: 600 }}>
                        {u.amount > 0 ? '+' : ''}{(u.amount || 0).toLocaleString()}P
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* 충전 내역 */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            <History sx={{ verticalAlign: 'middle', mr: 1 }} />충전 내역
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                  <TableCell><strong>날짜</strong></TableCell>
                  <TableCell><strong>충전 포인트</strong></TableCell>
                  <TableCell><strong>수수료</strong></TableCell>
                  <TableCell><strong>총 결제</strong></TableCell>
                  <TableCell><strong>상태</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {chargeHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#999' }}>충전 내역이 없습니다</TableCell>
                  </TableRow>
                ) : chargeHistory.map((ch) => (
                  <TableRow key={ch.id} hover>
                    <TableCell sx={{ fontSize: 13 }}>{formatDate(ch.createdAt)}</TableCell>
                    <TableCell sx={{ color: '#4CAF50', fontWeight: 600 }}>+{(ch.points || 0).toLocaleString()}P</TableCell>
                    <TableCell sx={{ color: '#999' }}>{(ch.fee || 0).toLocaleString()}원</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{(ch.totalPayment || 0).toLocaleString()}원</TableCell>
                    <TableCell>
                      <Chip label={ch.status === 'completed' ? '승인 완료' : ch.status === 'pending' ? '입금 대기' : '거절'}
                        color={ch.status === 'completed' ? 'success' : ch.status === 'pending' ? 'warning' : 'error'} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 충전 다이얼로그 */}
      <Dialog open={chargeDialog} onClose={() => setChargeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>포인트 충전</DialogTitle>
        <DialogContent>
          {selectedAmount ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>{selectedAmount.toLocaleString()}P 충전</Typography>
              <Box sx={{ bgcolor: '#F5F5F5', borderRadius: 2, p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>충전 포인트</Typography>
                  <Typography fontWeight={600} color="primary">{selectedAmount.toLocaleString()}P</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography color="text.secondary">수수료 ({(feeRate * 100).toFixed(0)}%)</Typography>
                  <Typography color="text.secondary">+{Math.round(selectedAmount * feeRate).toLocaleString()}원</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography fontWeight={700}>총 결제 금액</Typography>
                  <Typography fontWeight={700} color="error">
                    {(selectedAmount + Math.round(selectedAmount * feeRate)).toLocaleString()}원
                  </Typography>
                </Box>
              </Box>

              {/* 입금 계좌 안내 */}
              {bankInfo.bankAccount ? (
                <Alert severity="info" sx={{ textAlign: 'left' }}>
                  아래 계좌로 입금 후 충전 요청을 해주세요.
                  관리자가 입금 확인 후 승인하면 잔액에 반영됩니다.
                  <br /><br />
                  <strong>입금 계좌: {bankInfo.bankName} {bankInfo.bankAccount} ({bankInfo.bankHolder})</strong>
                </Alert>
              ) : (
                <Alert severity="warning" sx={{ textAlign: 'left' }}>
                  입금 계좌 정보를 불러오지 못했습니다. 관리자에게 문의해주세요.
                </Alert>
              )}
            </Box>
          ) : (
            <TextField fullWidth label="충전할 포인트 직접 입력" type="number"
              value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} sx={{ mt: 1 }}
              helperText={
                customAmount && parseInt(customAmount) > 0
                  ? `결제 금액: ${(parseInt(customAmount) + Math.round(parseInt(customAmount) * feeRate)).toLocaleString()}원 (수수료 포함)`
                  : '최소 1,000P부터 충전 가능'
              }
              InputProps={{ endAdornment: <Typography>P</Typography> }} />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setChargeDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleCharge} disabled={charging}
            startIcon={charging ? <CircularProgress size={18} /> : <Payment />}
            sx={{ bgcolor: '#FF6B6B' }}>
            {charging ? '처리 중...' : '충전 요청'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
