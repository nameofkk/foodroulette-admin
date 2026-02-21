import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField,
  Switch, FormControlLabel, Chip, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Snackbar, CircularProgress,
} from '@mui/material';
import {
  AccountBalanceWallet, CardGiftcard, People, Store, Search, History, Info
} from '@mui/icons-material';
import { db, auth } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy,
  onSnapshot, getDocs, serverTimestamp,
} from 'firebase/firestore';

export default function OwnerBonus({ storeId: propStoreId, ownerId }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noStore, setNoStore] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pointsPerVisit, setPointsPerVisit] = useState(0);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [settingsChanged, setSettingsChanged] = useState(false);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
  loadAllStores();
  loadWallet();

  // ★ 언마운트 시 리스너 정리
  return () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const loadWallet = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const walletRef = doc(db, 'ownerWallets', uid);
      const snap = await getDoc(walletRef);
      if (snap.exists()) {
        setWalletBalance(snap.data().balance || 0);
      } else {
        await setDoc(walletRef, {
          ownerEmail: auth.currentUser?.email || '',
          balance: 0, totalCharged: 0, totalUsed: 0, totalFee: 0,
          createdAt: serverTimestamp(),
        });
        setWalletBalance(0);
      }
    } catch (e) {
      console.error('지갑 로드 실패:', e);
    }
  };

  const loadAllStores = async () => {
    setLoading(true);
    try {
      const userEmail = auth.currentUser?.email || '';
      const q = query(collection(db, 'ownerStores'), where('ownerEmail', '==', userEmail));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStores(list);

      if (list.length > 0) {
        const target = propStoreId ? list.find(s => s.id === propStoreId) || list[0] : list[0];
        setSelectedStore(target);
        loadStoreSettings(target);
        loadBonusHistory(target.kakaoPlaceId || target.id);
      } else {
        setNoStore(true);
      }
    } catch (e) {
      setNoStore(true);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreSettings = (store) => {
    setPointsPerVisit(store.bonusPointsPerVisit || 0);
    setBonusActive(store.bonusPointsActive || false);
    setSettingsChanged(false);
  };

const loadBonusHistory = (restaurantId) => {
  // ★ 기존 리스너 정리
  if (unsubscribeRef.current) {
    unsubscribeRef.current();
    unsubscribeRef.current = null;
  }

  const restaurantIdStr = String(restaurantId);
  try {
    const q = query(
      collection(db, 'bonusPayments'),
      where('restaurantId', '==', restaurantIdStr),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setBonusHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      // fallback: visits
      try {
        const q2 = query(
          collection(db, 'visits'),
          where('restaurantId', '==', restaurantIdStr),
          orderBy('createdAt', 'desc')
        );
        const unsub2 = onSnapshot(q2, (snap) => {
          setBonusHistory(snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'visit' })));
        }, () => setBonusHistory([]));
        // fallback 리스너도 저장
        unsubscribeRef.current = unsub2;
      } catch (e2) { setBonusHistory([]); }
    });
    unsubscribeRef.current = unsub;
  } catch (e) { setBonusHistory([]); }
};


  const selectStore = (store) => {
    setSelectedStore(store);
    loadStoreSettings(store);
    loadBonusHistory(store.kakaoPlaceId || store.id);
  };

  const handleSaveSettings = async () => {
    if (!selectedStore) return;
    try {
      await updateDoc(doc(db, 'ownerStores', selectedStore.id), {
        bonusPointsPerVisit: pointsPerVisit,
        bonusPointsActive: bonusActive,
        updatedAt: serverTimestamp(),
      });
      setSettingsChanged(false);
      setSnackbar({ open: true, message: '보너스 설정이 저장되었습니다.', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: '설정 저장 실패', severity: 'error' });
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  }

  if (noStore) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>보너스 포인트 관리</Typography>
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3, mt: 3 }}>
          <Store sx={{ fontSize: 64, color: '#DDD', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>등록된 가게가 없습니다</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            먼저 "내 가게 관리"에서 가게를 등록해주세요.
          </Typography>
          <Button variant="contained" startIcon={<Search />} href="/owner-store"
            sx={{ bgcolor: '#FF6B6B' }}>내 가게 등록하러 가기</Button>
        </Card>
      </Box>
    );
  }

  const estimatedVisits = pointsPerVisit > 0 ? Math.floor(walletBalance / pointsPerVisit) : 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>보너스 포인트 관리</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        가게별 방문 보너스를 설정하고 지급 내역을 확인하세요.
        보너스는 <strong>통합 지갑</strong>에서 차감됩니다.
        충전은 <Chip label="포인트 충전" size="small" component="a" href="/owner-wallet" clickable sx={{ mx: 0.5 }} /> 메뉴에서 할 수 있습니다.
      </Typography>

      {/* 가게 선택 */}
      {stores.length > 1 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {stores.map((s) => (
            <Chip key={s.id} label={s.name}
              onClick={() => selectStore(s)}
              color={selectedStore?.id === s.id ? 'primary' : 'default'}
              variant={selectedStore?.id === s.id ? 'filled' : 'outlined'} />
          ))}
        </Box>
      )}

      {/* 상단 요약 — 통합 지갑 잔액 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AccountBalanceWallet color="primary" />
              <Typography color="text.secondary" fontSize={13}>통합 지갑 잔액</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700} color={walletBalance > 0 ? 'primary' : 'error'}>
              {walletBalance.toLocaleString()}P
            </Typography>
            {pointsPerVisit > 0 && (
              <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
                약 {estimatedVisits}명에게 지급 가능 (모든 가게 공통)
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CardGiftcard color="warning" />
              <Typography color="text.secondary" fontSize={13}>
                {selectedStore?.name || ''} 방문당 지급
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700} color="warning.main">
              {pointsPerVisit > 0 ? `${pointsPerVisit.toLocaleString()}P` : '미설정'}
            </Typography>
            <Chip label={bonusActive ? '활성화' : '비활성화'}
              color={bonusActive ? 'success' : 'default'} size="small" sx={{ mt: 0.5 }} />
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <People color="success" />
              <Typography color="text.secondary" fontSize={13}>연결된 가게</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>{stores.length}개</Typography>
            <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
              모든 가게가 같은 지갑 사용
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 보너스 설정 */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            보너스 설정 — {selectedStore?.name || ''}
          </Typography>

          {/* 작동 방식 설명 */}
          <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Info sx={{ color: '#2196F3', mt: 0.3 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>방문 보너스는 이렇게 작동합니다</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  1. 고객이 룰렛에서 이 매장을 선택하고 실제로 방문합니다.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  2. 고객이 앱에서 방문 인증(GPS 확인)을 완료합니다.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  3. 인증 확인 후 설정한 보너스 포인트가 고객에게 <strong>자동 지급</strong>됩니다.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  4. 지급된 포인트는 사장님의 <strong>통합 지갑 잔액</strong>에서 차감됩니다. (가게별 예산이 아닌 하나의 지갑에서 공통 차감)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  5. 잔액이 부족하면 보너스가 지급되지 않으며, 고객에게는 기본 포인트만 지급됩니다.
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" color="text.secondary">
                  💡 <strong>팁:</strong> 100~500P가 일반적이며, 프로모션 기간에는 1,000P 이상을 추천합니다.
                  가게마다 다른 보너스를 설정할 수 있지만, 차감은 모두 통합 지갑에서 됩니다.
                </Typography>
              </Box>
            </Box>
          </Card>

          <FormControlLabel
            control={
              <Switch checked={bonusActive}
                onChange={(e) => { setBonusActive(e.target.checked); setSettingsChanged(true); }}
                color="success" />
            }
            label={bonusActive ? '보너스 활성화됨' : '보너스 비활성화됨'}
            sx={{ mb: 2 }}
          />

          <Typography fontSize={14} sx={{ mb: 1 }}>방문당 지급 포인트</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {[100, 200, 300, 500, 1000, 2000].map((v) => (
              <Chip key={v} label={`${v}P`}
                onClick={() => { setPointsPerVisit(v); setSettingsChanged(true); }}
                color={pointsPerVisit === v ? 'primary' : 'default'}
                variant={pointsPerVisit === v ? 'filled' : 'outlined'} />
            ))}
          </Box>

          <TextField label="직접 입력" type="number" size="small" value={pointsPerVisit}
            onChange={(e) => { setPointsPerVisit(parseInt(e.target.value) || 0); setSettingsChanged(true); }}
            sx={{ width: 200, mb: 2 }}
            InputProps={{ endAdornment: <Typography color="text.secondary">P</Typography> }} />

          {pointsPerVisit > 0 && walletBalance > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              통합 지갑 잔액({walletBalance.toLocaleString()}P)으로 약 <strong>{estimatedVisits}명</strong>에게 {pointsPerVisit}P씩 지급 가능합니다.
              {stores.length > 1 && ' (모든 가게에서 공통 차감)'}
            </Alert>
          )}

          {walletBalance <= 0 && bonusActive && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              지갑 잔액이 0입니다. <strong>포인트 충전</strong> 메뉴에서 충전해야 보너스가 지급됩니다.
            </Alert>
          )}

          <Button variant="contained" onClick={handleSaveSettings} disabled={!settingsChanged}
            sx={{ bgcolor: '#FF6B6B' }}>
            설정 저장
          </Button>
        </CardContent>
      </Card>

      {/* 보너스 지급 내역 */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            <History sx={{ verticalAlign: 'middle', mr: 1 }} />
            보너스 지급 내역 — {selectedStore?.name || ''}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                  <TableCell><strong>날짜</strong></TableCell>
                  <TableCell><strong>사용자</strong></TableCell>
                  <TableCell><strong>지급 포인트</strong></TableCell>
                  <TableCell><strong>유형</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bonusHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: '#999' }}>
                      보너스 지급 내역이 없습니다
                    </TableCell>
                  </TableRow>
                ) : bonusHistory.slice(0, 30).map((h) => (
                  <TableRow key={h.id} hover>
                    <TableCell sx={{ fontSize: 13 }}>{formatDate(h.createdAt)}</TableCell>
                    <TableCell>{h.userName || h.userEmail || '-'}</TableCell>
                    <TableCell sx={{ color: '#4CAF50', fontWeight: 600 }}>
                      +{(h.bonusPoints || h.points || pointsPerVisit || 0).toLocaleString()}P
                    </TableCell>
                    <TableCell>
                      <Chip label={h.type === 'visit' ? '방문 인증' : '보너스'} size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
