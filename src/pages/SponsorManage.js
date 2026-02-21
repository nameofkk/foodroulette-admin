import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip
} from '@mui/material';
import { Refresh, Edit, Block, Search } from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, getDocs, updateDoc, doc, query, where, serverTimestamp
} from 'firebase/firestore';

export default function SponsorManage() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState(null);
  const [editForm, setEditForm] = useState({ bonusPoints: 0, bonusMultiplier: 1.5 });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadSponsors(); }, []);

  const loadSponsors = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'ownerStores'), where('sponsorStatus', '==', 'approved'));
      const snap = await getDocs(q);
      setSponsors(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      })));
    } catch (error) {
      console.error('스폰서 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

      const handleEdit = (sponsor) => {
    setSelectedSponsor(sponsor);
    setEditForm({
      bonusPoints: sponsor.sponsorBonusPoints || sponsor.bonusPoints || 0,
      bonusMultiplier: sponsor.bonusMultiplier || 1.5
    });
    setEditDialog(true);    // ← 다이얼로그 열기 (이것도 빠져있었음)
  };                         // ← 함수 닫기

  const handleSaveEdit = async () => {

    if (!selectedSponsor) return;
    try {
      await updateDoc(doc(db, 'ownerStores', selectedSponsor.id), {
        // ★ 스폰서 보너스 전용 필드
        sponsorBonusPoints: editForm.bonusPoints,
        bonusMultiplier: editForm.bonusMultiplier,
        updatedAt: serverTimestamp()
      });
      setEditDialog(false);
      setSnackbar({ open: true, message: '스폰서 보너스 수정 완료', severity: 'success' });
      loadSponsors();
    } catch (error) {
      setSnackbar({ open: true, message: '수정 실패', severity: 'error' });
    }
  };

  const handleDeactivate = async (sponsor) => {
    if (!window.confirm(`${sponsor.name}의 스폰서를 해제하시겠습니까?`)) return;
    try {
      await updateDoc(doc(db, 'ownerStores', sponsor.id), {
        isSponsored: false, sponsorStatus: 'none', updatedAt: serverTimestamp()
      });
      setSnackbar({ open: true, message: '스폰서 해제 완료', severity: 'warning' });
      loadSponsors();
    } catch (error) {
      setSnackbar({ open: true, message: '해제 실패', severity: 'error' });
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const filtered = sponsors.filter(s =>
    !searchTerm ||
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.ownerEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">스폰서 맛집 관리</Typography>
        <Button startIcon={<Refresh />} onClick={loadSponsors} variant="outlined">새로고침</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField size="small" placeholder="가게명, 이메일, 카테고리 검색" value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#999' }} /> }}
          sx={{ width: 400 }} />
        <Chip label={`${filtered.length}개`} />
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                <TableCell><strong>가게명</strong></TableCell>
                <TableCell><strong>카테고리</strong></TableCell>
                <TableCell><strong>사장님 이메일</strong></TableCell>
                <TableCell><strong>카카오 ID</strong></TableCell>
                <TableCell><strong>보너스 포인트</strong></TableCell>
                <TableCell><strong>배율</strong></TableCell>
                <TableCell><strong>등록일</strong></TableCell>
                <TableCell align="center"><strong>관리</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  {searchTerm ? '검색 결과가 없습니다' : '승인된 스폰서가 없습니다'}
                </TableCell></TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                  <TableCell>{s.category || '-'}</TableCell>
                  <TableCell>{s.ownerEmail || '-'}</TableCell>
                  <TableCell><Chip label={s.kakaoPlaceId || '-'} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ color: '#FF6B6B', fontWeight: 600 }}>
  {(s.sponsorBonusPoints || s.bonusPoints || 0).toLocaleString()}P
</TableCell>
                  <TableCell>x{s.bonusMultiplier || 1}</TableCell>
                  <TableCell>{formatDate(s.createdAt)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="보너스 수정">
                      <IconButton size="small" onClick={() => handleEdit(s)}><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="스폰서 해제">
                      <IconButton size="small" color="error" onClick={() => handleDeactivate(s)}><Block fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>보너스 포인트 수정</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {selectedSponsor && (
            <Typography variant="body2" gutterBottom><strong>가게:</strong> {selectedSponsor.name}</Typography>
          )}
          <TextField fullWidth label="보너스 포인트" type="number" value={editForm.bonusPoints}
            onChange={(e) => setEditForm({ ...editForm, bonusPoints: Number(e.target.value) })} sx={{ mb: 2, mt: 2 }} />
          <TextField fullWidth label="배율" type="number" value={editForm.bonusMultiplier}
            onChange={(e) => setEditForm({ ...editForm, bonusMultiplier: Number(e.target.value) })} inputProps={{ step: 0.1 }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveEdit} sx={{ bgcolor: '#FF6B6B' }}>저장</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
