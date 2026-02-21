import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Switch, FormControlLabel, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function Sponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [form, setForm] = useState({
    name: '', kakaoPlaceId: '', category: '', bonusPoints: 3000,
    bonusMultiplier: 2, active: true, contractStart: '', contractEnd: ''
  });

  useEffect(() => { loadSponsors(); }, []);

  const loadSponsors = async () => {
    try {
      const snap = await getDocs(collection(db, 'sponsors'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSponsors(list);
    } catch (error) {
      console.error('스폰서 로드 실패:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editingSponsor) {
        await updateDoc(doc(db, 'sponsors', editingSponsor.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'sponsors'), { ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      setDialogOpen(false);
      setEditingSponsor(null);
      setForm({ name: '', kakaoPlaceId: '', category: '', bonusPoints: 3000, bonusMultiplier: 2, active: true, contractStart: '', contractEnd: '' });
      loadSponsors();
    } catch (error) {
      console.error('저장 실패:', error);
    }
  };

  const handleEdit = (sponsor) => {
    setEditingSponsor(sponsor);
    setForm({
      name: sponsor.name || '', kakaoPlaceId: sponsor.kakaoPlaceId || '',
      category: sponsor.category || '', bonusPoints: sponsor.bonusPoints || 3000,
      bonusMultiplier: sponsor.bonusMultiplier || 2, active: sponsor.active !== false,
      contractStart: sponsor.contractStart || '', contractEnd: sponsor.contractEnd || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'sponsors', id));
      loadSponsors();
    }
  };

  const handleAdd = () => {
    setEditingSponsor(null);
    setForm({ name: '', kakaoPlaceId: '', category: '', bonusPoints: 3000, bonusMultiplier: 2, active: true, contractStart: '', contractEnd: '' });
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>🏪 스폰서 맛집 관리</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}
          sx={{ bgcolor: '#FF6B6B', '&:hover': { bgcolor: '#FF4757' } }}>
          스폰서 추가
        </Button>
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                <TableCell sx={{ fontWeight: 600 }}>맛집명</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>카테고리</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>보너스P</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>배율</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>상태</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>계약기간</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sponsors.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>등록된 스폰서가 없습니다</TableCell></TableRow>
              ) : sponsors.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell>+{(s.bonusPoints || 0).toLocaleString()}P</TableCell>
                  <TableCell>x{s.bonusMultiplier || 2}</TableCell>
                  <TableCell>
                    <Chip label={s.active ? '활성' : '비활성'} size="small"
                      color={s.active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{s.contractStart || '-'} ~ {s.contractEnd || '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(s)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSponsor ? '스폰서 수정' : '스폰서 추가'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="맛집명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="카카오 Place ID" value={form.kakaoPlaceId} onChange={(e) => setForm({ ...form, kakaoPlaceId: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="카테고리" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="보너스 포인트" type="number" value={form.bonusPoints} onChange={(e) => setForm({ ...form, bonusPoints: Number(e.target.value) })} sx={{ mb: 2 }} />
          <TextField fullWidth label="보너스 배율" type="number" value={form.bonusMultiplier} onChange={(e) => setForm({ ...form, bonusMultiplier: Number(e.target.value) })} sx={{ mb: 2 }} />
          <TextField fullWidth label="계약 시작일" type="date" value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth label="계약 종료일" type="date" value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />
          <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />} label="활성화" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#FF6B6B' }}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
