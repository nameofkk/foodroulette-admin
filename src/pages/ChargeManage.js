import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress
} from '@mui/material';
import { CheckCircle, Cancel, AccountBalanceWallet } from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc,
  setDoc, getDoc, increment, serverTimestamp, addDoc  // ← addDoc 추가!
} from 'firebase/firestore';

export default function ChargeManage() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, charge: null, action: '' });
  const [processing, setProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const q = query(collection(db, 'ownerCharges'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCharges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleApprove = async (charge) => {
    setProcessing(true);
    try {
      const walletId = charge.ownerId || charge.walletId;

      if (!walletId) {
        setSnackbar({
          open: true,
          message: '오류: 이 충전 요청에 사장님 ID(ownerId)가 없습니다.',
          severity: 'error',
        });
        setProcessing(false);
        setConfirmDialog({ open: false, charge: null, action: '' });
        return;
      }

      // ★ 이중 승인 방지: 현재 상태 재확인
      const chargeSnap = await getDoc(doc(db, 'ownerCharges', charge.id));
      if (!chargeSnap.exists()) {
        setSnackbar({ open: true, message: '충전 요청을 찾을 수 없습니다.', severity: 'error' });
        setProcessing(false);
        setConfirmDialog({ open: false, charge: null, action: '' });
        return;
      }
      if (chargeSnap.data().status !== 'pending') {
        setSnackbar({ open: true, message: '이미 처리된 요청입니다.', severity: 'warning' });
        setProcessing(false);
        setConfirmDialog({ open: false, charge: null, action: '' });
        return;
      }

      console.log('승인 시작 - walletId:', walletId, 'points:', charge.points);

      // 1. 충전 상태 업데이트
      await updateDoc(doc(db, 'ownerCharges', charge.id), {
        status: 'completed',
        approvedAt: serverTimestamp(),
      });
      console.log('1단계 완료: 충전 상태 completed로 변경');

      // 2. 통합 지갑에 반영
      const walletRef = doc(db, 'ownerWallets', walletId);
      const walletSnap = await getDoc(walletRef);

      if (walletSnap.exists()) {
        await updateDoc(walletRef, {
          balance: increment(charge.points),
          totalCharged: increment(charge.totalPayment || charge.points),
          totalFee: increment(charge.fee || 0),
          updatedAt: serverTimestamp(),
        });
        console.log('2단계 완료: 지갑 업데이트 (기존 지갑)');
      } else {
        await setDoc(walletRef, {
          ownerEmail: charge.ownerEmail || '',
          balance: charge.points,
          totalCharged: charge.totalPayment || charge.points,
          totalUsed: 0,
          totalFee: charge.fee || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('2단계 완료: 지갑 새로 생성');
      }

      // 3. 지갑 트랜잭션 기록
      await addDoc(collection(db, 'walletTransactions'), {
        ownerId: walletId,
        ownerEmail: charge.ownerEmail || '',
        type: 'charge_approved',
        description: `포인트 충전 승인 (${charge.points?.toLocaleString()}P)`,
        amount: charge.points,
        createdAt: serverTimestamp(),
      });
      console.log('3단계 완료: 트랜잭션 기록');

      setSnackbar({
        open: true,
        message: `${charge.ownerEmail} — ${charge.points?.toLocaleString()}P 충전 승인 완료`,
        severity: 'success',
      });
    } catch (e) {
      console.error('승인 실패 상세:', e);
      setSnackbar({ open: true, message: '승인 처리 실패: ' + e.message, severity: 'error' });
    } finally {
      setProcessing(false);
      setConfirmDialog({ open: false, charge: null, action: '' });
    }
  };

  const handleReject = async (charge) => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'ownerCharges', charge.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
      });
      setSnackbar({
        open: true,
        message: `${charge.ownerEmail} 충전 요청이 거절되었습니다.`,
        severity: 'warning',
      });
    } catch (e) {
      setSnackbar({ open: true, message: '거절 처리 실패', severity: 'error' });
    } finally {
      setProcessing(false);
      setConfirmDialog({ open: false, charge: null, action: '' });
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getStatusChip = (status) => {
    const map = {
      pending: { label: '입금 대기', color: 'warning' },
      completed: { label: '승인 완료', color: 'success' },
      rejected: { label: '거절', color: 'error' },
    };
    const s = map[status] || { label: status, color: 'default' };
    return <Chip label={s.label} color={s.color} size="small" />;
  };

  const pendingCount = charges.filter(c => c.status === 'pending').length;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">충전 요청 관리</Typography>
        {pendingCount > 0 && (
          <Chip icon={<AccountBalanceWallet />} label={`대기 ${pendingCount}건`} color="warning" />
        )}
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                  <TableCell><strong>요청일</strong></TableCell>
                  <TableCell><strong>사장님 이메일</strong></TableCell>
                  <TableCell><strong>Owner ID</strong></TableCell>
                  <TableCell><strong>충전 포인트</strong></TableCell>
                  <TableCell><strong>수수료</strong></TableCell>
                  <TableCell><strong>총 입금액</strong></TableCell>
                  <TableCell><strong>상태</strong></TableCell>
                  <TableCell align="center"><strong>관리</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {charges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#999' }}>
                      충전 요청 내역이 없습니다
                    </TableCell>
                  </TableRow>
                ) : charges.map((ch) => (
                  <TableRow key={ch.id} hover sx={ch.status === 'pending' ? { bgcolor: '#FFF8E1' } : {}}>
                    <TableCell sx={{ fontSize: 13 }}>{formatDate(ch.createdAt)}</TableCell>
                    <TableCell>{ch.ownerEmail || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={ch.ownerId ? ch.ownerId.substring(0, 8) + '...' : '없음'}
                        size="small"
                        variant="outlined"
                        color={ch.ownerId ? 'default' : 'error'}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#4CAF50', fontWeight: 600 }}>{(ch.points || 0).toLocaleString()}P</TableCell>
                    <TableCell sx={{ color: '#999' }}>{(ch.fee || 0).toLocaleString()}원</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{(ch.totalPayment || 0).toLocaleString()}원</TableCell>
                    <TableCell>{getStatusChip(ch.status)}</TableCell>
                    <TableCell align="center">
                      {ch.status === 'pending' ? (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                            onClick={() => setConfirmDialog({ open: true, charge: ch, action: 'approve' })}
                            disabled={!ch.ownerId}>
                            승인
                          </Button>
                          <Button size="small" variant="outlined" color="error" startIcon={<Cancel />}
                            onClick={() => setConfirmDialog({ open: true, charge: ch, action: 'reject' })}>
                            거절
                          </Button>
                        </Box>
                      ) : (
                        <Typography fontSize={12} color="text.secondary">
                          {ch.status === 'completed' ? formatDate(ch.approvedAt) : '거절됨'}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={confirmDialog.open}
        onClose={() => !processing && setConfirmDialog({ open: false, charge: null, action: '' })}
        maxWidth="xs" fullWidth>
        <DialogTitle>{confirmDialog.action === 'approve' ? '충전 승인' : '충전 거절'}</DialogTitle>
        <DialogContent>
          {confirmDialog.charge && (
            <Box sx={{ py: 1 }}>
              <Typography gutterBottom><strong>사장님:</strong> {confirmDialog.charge.ownerEmail || '-'}</Typography>
              <Typography gutterBottom><strong>Owner ID:</strong> {confirmDialog.charge.ownerId || '없음'}</Typography>
              <Typography gutterBottom><strong>충전 포인트:</strong> {confirmDialog.charge.points?.toLocaleString()}P</Typography>
              <Typography gutterBottom><strong>총 입금액:</strong> {confirmDialog.charge.totalPayment?.toLocaleString()}원</Typography>
              {!confirmDialog.charge.ownerId && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  이 충전 요청에 Owner ID가 없습니다. 승인할 수 없습니다.
                </Alert>
              )}
              {confirmDialog.action === 'approve' && confirmDialog.charge.ownerId ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  입금 확인 후 승인하세요. 승인하면 해당 계정의 <strong>통합 지갑</strong>에 즉시 반영됩니다.
                </Alert>
              ) : confirmDialog.action === 'reject' && (
                <Alert severity="error" sx={{ mt: 2 }}>거절하면 충전이 반영되지 않습니다.</Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmDialog({ open: false, charge: null, action: '' })} disabled={processing}>취소</Button>
          <Button variant="contained"
            color={confirmDialog.action === 'approve' ? 'success' : 'error'}
            onClick={() => confirmDialog.action === 'approve' ? handleApprove(confirmDialog.charge) : handleReject(confirmDialog.charge)}
            disabled={processing || (confirmDialog.action === 'approve' && !confirmDialog.charge?.ownerId)}
            startIcon={processing ? <CircularProgress size={18} /> : null}>
            {processing ? '처리 중...' : confirmDialog.action === 'approve' ? '승인' : '거절'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
