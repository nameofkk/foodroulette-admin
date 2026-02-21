import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
  Grid, CardContent
} from '@mui/material';
import {
  Refresh, CheckCircle, Cancel, Visibility, Search,
  Pending, Done, ErrorOutline
} from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, getDocs, updateDoc, setDoc, doc, query, orderBy, serverTimestamp
} from 'firebase/firestore';

export default function SponsorApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'sponsorApplications'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      }));
      setApplications(items);
      const s = { pending: 0, approved: 0, rejected: 0 };
      items.forEach(a => { if (s[a.status] !== undefined) s[a.status]++; });
      setStats(s);
    } catch (error) {
      console.error('신청 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

const handleApprove = async (app) => {
  try {
    await updateDoc(doc(db, 'sponsorApplications', app.id), {
      status: 'approved', updatedAt: serverTimestamp()
    });
    if (app.storeId) {
      await setDoc(doc(db, 'ownerStores', app.storeId), {
        sponsorStatus: 'approved',
        isSponsored: false,        // 레벨 결제 전까지는 false
        priorityLevel: 0,          // 레벨 미선택 상태
        priorityWeight: 0,         // 가중치 없음
        sponsorActivatedAt: null,   // 활성화 시점 없음
        sponsorExpiresAt: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    setSnackbar({ open: true, message: `${app.storeName} 스폰서 승인 완료 (사장님이 레벨 선택 후 활성화됩니다)`, severity: 'success' });
    setDetailDialog(false);
    loadApplications();
  } catch (error) {
    setSnackbar({ open: true, message: '승인 실패: ' + error.message, severity: 'error' });
  }
};


  const handleReject = async (app) => {
    try {
      await updateDoc(doc(db, 'sponsorApplications', app.id), {
        status: 'rejected', rejectReason, updatedAt: serverTimestamp()
      });
      if (app.storeId) {
        await setDoc(doc(db, 'ownerStores', app.storeId), {
          sponsorStatus: 'rejected', isSponsored: false, updatedAt: serverTimestamp()
        }, { merge: true });
      }
      setSnackbar({ open: true, message: `${app.storeName} 스폰서 거절`, severity: 'warning' });
      setDetailDialog(false);
      setRejectReason('');
      loadApplications();
    } catch (error) {
      setSnackbar({ open: true, message: '거절 실패: ' + error.message, severity: 'error' });
    }
  };

  const getStatusChip = (status) => {
    const map = {
      pending: { label: '심사 대기', color: 'warning', icon: <Pending /> },
      approved: { label: '승인됨', color: 'success', icon: <Done /> },
      rejected: { label: '거절됨', color: 'error', icon: <ErrorOutline /> },
    };
    const s = map[status] || map.pending;
    return <Chip icon={s.icon} label={s.label} color={s.color} size="small" />;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const filtered = applications.filter(a => {
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchSearch = !searchTerm ||
      (a.storeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.ownerEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">스폰서 신청 관리</Typography>
        <Button startIcon={<Refresh />} onClick={loadApplications} variant="outlined">새로고침</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Card sx={{ bgcolor: '#FFF3E0', cursor: 'pointer' }} onClick={() => setFilterStatus('pending')}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Pending sx={{ color: '#FF9800', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold" color="#FF9800">{stats.pending}</Typography>
              <Typography variant="body2" color="text.secondary">심사 대기</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ bgcolor: '#E8F5E9', cursor: 'pointer' }} onClick={() => setFilterStatus('approved')}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Done sx={{ color: '#4CAF50', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold" color="#4CAF50">{stats.approved}</Typography>
              <Typography variant="body2" color="text.secondary">승인됨</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ bgcolor: '#FFEBEE', cursor: 'pointer' }} onClick={() => setFilterStatus('rejected')}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <ErrorOutline sx={{ color: '#F44336', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold" color="#F44336">{stats.rejected}</Typography>
              <Typography variant="body2" color="text.secondary">거절됨</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField size="small" placeholder="가게명, 이메일로 검색" value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#999' }} /> }}
          sx={{ width: 400 }} />
        {filterStatus !== 'all' && (
          <Chip label={`필터: ${filterStatus}`} onDelete={() => setFilterStatus('all')} color="primary" />
        )}
        <Chip label={`${filtered.length}건`} />
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                <TableCell><strong>신청일</strong></TableCell>
                <TableCell><strong>가게명</strong></TableCell>
                <TableCell><strong>사장님 이메일</strong></TableCell>
                <TableCell><strong>보너스 포인트</strong></TableCell>
                <TableCell><strong>배율</strong></TableCell>
                <TableCell><strong>계약 기간</strong></TableCell>
                <TableCell align="center"><strong>상태</strong></TableCell>
                <TableCell align="center"><strong>관리</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>신청 내역이 없습니다</TableCell></TableRow>
              ) : filtered.map((app) => (
                <TableRow key={app.id} hover>
                  <TableCell>{formatDate(app.createdAt)}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{app.storeName}</TableCell>
                  <TableCell>{app.ownerEmail}</TableCell>
                  <TableCell>{(app.bonusPoints || 0).toLocaleString()}P</TableCell>
                  <TableCell>x{app.bonusMultiplier || 1}</TableCell>
                  <TableCell>{app.contractMonths || 1}개월</TableCell>
                  <TableCell align="center">{getStatusChip(app.status)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="상세/처리">
                      <IconButton size="small" onClick={() => {
                        setSelectedApp(app); setRejectReason(''); setDetailDialog(true);
                      }}><Visibility fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>스폰서 신청 상세</DialogTitle>
        <DialogContent>
          {selectedApp && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom><strong>가게명:</strong> {selectedApp.storeName}</Typography>
              <Typography variant="body2" gutterBottom><strong>사장님:</strong> {selectedApp.ownerEmail}</Typography>
              <Typography variant="body2" gutterBottom><strong>보너스 포인트:</strong> {(selectedApp.bonusPoints || 0).toLocaleString()}P</Typography>
              <Typography variant="body2" gutterBottom><strong>배율:</strong> x{selectedApp.bonusMultiplier || 1}</Typography>
              <Typography variant="body2" gutterBottom><strong>계약 기간:</strong> {selectedApp.contractMonths || 1}개월</Typography>
              <Typography variant="body2" gutterBottom><strong>상태:</strong> {selectedApp.status}</Typography>
              <Typography variant="body2" gutterBottom><strong>신청일:</strong> {formatDate(selectedApp.createdAt)}</Typography>
              {selectedApp.status === 'rejected' && selectedApp.rejectReason && (
                <Alert severity="error" sx={{ mt: 2 }}>거절 사유: {selectedApp.rejectReason}</Alert>
              )}
              {(selectedApp.status === 'pending' || selectedApp.status === 'approved') && (
                <TextField fullWidth label="거절 사유 (거절 시 입력)" value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)} multiline rows={2} sx={{ mt: 2 }}
                  placeholder="거절할 경우 사유를 입력하세요" />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDetailDialog(false)} color="inherit">닫기</Button>
          {selectedApp?.status === 'pending' && (
            <>
              <Button variant="contained" color="success" startIcon={<CheckCircle />}
                onClick={() => handleApprove(selectedApp)}>승인</Button>
              <Button variant="contained" color="error" startIcon={<Cancel />}
                onClick={() => handleReject(selectedApp)}>거절</Button>
            </>
          )}
          {selectedApp?.status === 'approved' && (
            <Button variant="contained" color="error" startIcon={<Cancel />}
              onClick={() => handleReject(selectedApp)}>승인 취소</Button>
          )}
          {selectedApp?.status === 'rejected' && (
            <Button variant="contained" color="success" startIcon={<CheckCircle />}
              onClick={() => handleApprove(selectedApp)}>재승인</Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
