import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Switch, FormControlLabel,
  CircularProgress, Avatar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    name: '', description: '', pointCost: 0, stock: 0, category: '', active: true, imageUrl: ''
  });

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('상품 로드 실패:', error);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하만 가능합니다.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file) => {
    const fileName = `products/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  };

  const handleSave = async () => {
    try {
      setUploading(true);
      let imageUrl = form.imageUrl;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const saveData = { ...form, imageUrl, updatedAt: serverTimestamp() };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), saveData);
      } else {
        await addDoc(collection(db, 'products'), { ...saveData, createdAt: serverTimestamp() });
      }

      setDialogOpen(false);
      setEditingProduct(null);
      setImageFile(null);
      setPreviewUrl('');
      setForm({ name: '', description: '', pointCost: 0, stock: 0, category: '', active: true, imageUrl: '' });
      loadProducts();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 실패: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setImageFile(null);
    setPreviewUrl(product.imageUrl || '');
    setForm({
      name: product.name || '', description: product.description || '',
      pointCost: product.pointCost || 0, stock: product.stock || 0,
      category: product.category || '', active: product.active !== false, imageUrl: product.imageUrl || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'products', id));
      loadProducts();
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setImageFile(null);
    setPreviewUrl('');
    setForm({ name: '', description: '', pointCost: 0, stock: 0, category: '', active: true, imageUrl: '' });
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>포인트 상품 관리</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}
          sx={{ bgcolor: '#FF6B6B', '&:hover': { bgcolor: '#FF4757' } }}>
          상품 추가
        </Button>
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                <TableCell sx={{ fontWeight: 600 }}>이미지</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>상품명</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>설명</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>필요 포인트</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>재고</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>상태</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>등록된 상품이 없습니다</TableCell></TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    {p.imageUrl ? (
                      <Avatar variant="rounded" src={p.imageUrl} sx={{ width: 48, height: 48 }} />
                    ) : (
                      <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: '#F5F5F5' }}>
                        <ImageIcon sx={{ color: '#CCC' }} />
                      </Avatar>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</TableCell>
                  <TableCell>{(p.pointCost || 0).toLocaleString()}P</TableCell>
                  <TableCell>{p.stock || 0}개</TableCell>
                  <TableCell>
                    <Chip label={p.active ? '판매중' : '비활성'} size="small" color={p.active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(p)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => !uploading && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? '상품 수정' : '상품 추가'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {/* 이미지 업로드 */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            {previewUrl ? (
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={previewUrl}
                  alt="미리보기"
                  style={{
                    width: 160, height: 160, objectFit: 'cover',
                    borderRadius: 12, border: '2px solid #EEE'
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ mt: 1, display: 'block', mx: 'auto' }}
                >
                  이미지 변경
                </Button>
              </Box>
            ) : (
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: 160, height: 160, mx: 'auto',
                  border: '2px dashed #DDD', borderRadius: 3,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', bgcolor: '#FAFAFA',
                  '&:hover': { borderColor: '#FF6B6B', bgcolor: '#FFF5F5' }
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 40, color: '#CCC', mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  클릭하여 이미지 업로드
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  (최대 5MB)
                </Typography>
              </Box>
            )}
          </Box>

          <TextField fullWidth label="상품명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="설명" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="필요 포인트" type="number" value={form.pointCost} onChange={(e) => setForm({ ...form, pointCost: Number(e.target.value) })} sx={{ mb: 2 }} />
          <TextField fullWidth label="재고" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} sx={{ mb: 2 }} />
          <TextField fullWidth label="카테고리" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} sx={{ mb: 2 }}
            placeholder="카페, 편의점, 치킨, 기타" />
          <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />} label="판매 활성화" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={uploading}>취소</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={uploading || !form.name}
            sx={{ bgcolor: '#FF6B6B' }}
            startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {uploading ? '업로드 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
