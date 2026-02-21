import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip
} from '@mui/material';
import {
  Refresh, Delete, Visibility, Store, Search
} from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, getDocs, deleteDoc, doc, query, orderBy
} from 'firebase/firestore';

export default function OwnerStores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadStores(); }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'ownerStores'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setStores(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      })));
    } catch (error) {
      console.error('가게 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'ownerStores', id));
      setSnackbar({ open: true, message: '삭제 완료', severity: 'success' });
      loadStores();
    } catch (error) {
      setSnackbar({ open: true, message: '삭제 실패', severity: 'error' });
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getSponsorChip = (status) => {
    const map = {
      none: { label: '미신청', color: 'default' },
      pending: { label: '심사중', color: 'warning' },
      approved: { label: '승인됨', color: 'success' },
      rejected: { label: '거절됨', color: 'error' },
    };
    const s = map[status] || map.none;
    return <Chip label={s.label} color={s.color} size="small" />;
  };

  const filtered = stores.filter(s =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.ownerEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">등록 가게 관리</Typography>
        <Button startIcon={<Refresh />} onClick={loadStores} variant="outlined">새로고침</Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="가게명, 이메일, 카테고리 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#999' }} /> }}
          sx={{ width: 350 }}
        />
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                <TableCell><strong>가게명</strong></TableCell>
                <TableCell><strong>사장님 이메일</strong></TableCell>
                <TableCell><strong>카테고리</strong></TableCell>
                <TableCell><strong>주소</strong></TableCell>
                <TableCell><strong>스폰서</strong></TableCell>
                <TableCell><strong>등록일</strong></TableCell>
                <TableCell align="center"><strong>관리</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>등록된 가게가 없습니다</TableCell></TableRow>
              ) : filtered.map((store) => (
                <TableRow key={store.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{store.name}</TableCell>
                  <TableCell>{store.ownerEmail || '-'}</TableCell>
                  <TableCell>{store.category || '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {store.address || '-'}
                  </TableCell>
                  <TableCell>{getSponsorChip(store.sponsorStatus)}</TableCell>
                  <TableCell>{formatDate(store.createdAt)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="상세보기">
                      <IconButton size="small" onClick={() => { setSelectedStore(store); setDetailDialog(true); }}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="삭제">
                      <IconButton size="small" color="error" onClick={() => handleDelete(store.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>가게 상세 정보</DialogTitle>
        <DialogContent>
          {selectedStore && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom><strong>가게명:</strong> {selectedStore.name}</Typography>
              <Typography variant="body2" gutterBottom><strong>사장님 이메일:</strong> {selectedStore.ownerEmail}</Typography>
              <Typography variant="body2" gutterBottom><strong>카테고리:</strong> {selectedStore.category || '-'}</Typography>
              <Typography variant="body2" gutterBottom><strong>주소:</strong> {selectedStore.address || '-'}</Typography>
              <Typography variant="body2" gutterBottom><strong>전화번호:</strong> {selectedStore.phone || '-'}</Typography>
              <Typography variant="body2" gutterBottom><strong>설명:</strong> {selectedStore.description || '-'}</Typography>
              <Typography variant="body2" gutterBottom><strong>카카오 Place ID:</strong> {selectedStore.kakaoPlaceId || '-'}</Typography>
              <Typography variant="body2" gutterBottom><strong>스폰서 상태:</strong> {selectedStore.sponsorStatus || 'none'}</Typography>
              <Typography variant="body2" gutterBottom><strong>등록일:</strong> {formatDate(selectedStore.createdAt)}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
