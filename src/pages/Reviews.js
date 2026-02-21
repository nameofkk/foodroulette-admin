import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
  Rating, Select, MenuItem, FormControl, InputLabel, Grid, CardContent
} from '@mui/material';
import {
  Refresh, Search, Delete, Edit, Visibility, Flag,
  RateReview, Star, Cancel
} from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, getDocs, updateDoc, deleteDoc, addDoc, doc, query,
  orderBy, serverTimestamp
} from 'firebase/firestore';

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [detailDialog, setDetailDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [reportDetailDialog, setReportDetailDialog] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [editForm, setEditForm] = useState({ text: '', rating: 0 });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [stats, setStats] = useState({ total: 0, avgRating: 0, today: 0, reported: 0 });

  useEffect(() => { loadReviews(); loadReports(); }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || null
      }));
      setReviews(items);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = items.filter(r => new Date(r.createdAt) >= today).length;
      const avgRating = items.length > 0
        ? (items.reduce((sum, r) => sum + (r.rating || 0), 0) / items.length).toFixed(1) : 0;

      setStats(prev => ({ ...prev, total: items.length, avgRating: Number(avgRating), today: todayCount }));
    } catch (error) {
      console.error('리뷰 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const q = query(collection(db, 'reviewReports'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      }));
      setReports(items);
      const pendingCount = items.filter(r => r.status === 'pending').length;
      setStats(prev => ({ ...prev, reported: pendingCount }));
    } catch (error) {
      console.error('신고 로드 실패:', error);
    }
  };

  const getReportsForReview = (reviewId) => {
    return reports.filter(r => r.reviewId === reviewId);
  };


  const handleEdit = (review) => {
    setSelectedReview(review);
    setEditForm({ text: review.text || '', rating: review.rating || 0 });
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedReview) return;
    try {
      await updateDoc(doc(db, 'reviews', selectedReview.id), {
        text: editForm.text,
        rating: editForm.rating,
        editedByAdmin: true,
        updatedAt: serverTimestamp()
      });
      if (selectedReview.userId) {
        await addDoc(collection(db, 'notifications'), {
          userId: selectedReview.userId,
          title: '리뷰 수정 알림',
          message: `"${selectedReview.restaurantName || '맛집'}"에 작성하신 리뷰가 관리자에 의해 수정되었습니다.`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
      setEditDialog(false);
      setSnackbar({ open: true, message: '리뷰 수정 완료 (사용자에게 알림 전송됨)', severity: 'success' });
      loadReviews();
    } catch (error) {
      setSnackbar({ open: true, message: '수정 실패: ' + error.message, severity: 'error' });
    }
  };

  const handleDelete = async (review) => {
    if (!window.confirm(`이 리뷰를 삭제하시겠습니까?\n\n작성자: ${review.authorName || review.userId}\n내용: ${(review.text || '').substring(0, 50)}...`)) return;
        try {
      await deleteDoc(doc(db, 'reviews', review.id));

      // 알림은 실패해도 리뷰 삭제는 유지
      try {
        if (review.userId) {
          await addDoc(collection(db, 'notifications'), {
            userId: review.userId,
            title: '리뷰 삭제 알림',
            message: `"${review.restaurantName || '맛집'}"에 작성하신 리뷰가 운영 정책에 따라 삭제되었습니다.`,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } catch (notifError) {
        console.error('알림 발송 실패 (리뷰는 삭제됨):', notifError);
      }

      // 관련 신고도 처리 완료로
      const relatedReports = getReportsForReview(review.id);
      for (const report of relatedReports) {
        await updateDoc(doc(db, 'reviewReports', report.id), {
          status: 'resolved',
          resolution: 'deleted',
          updatedAt: serverTimestamp()
        });
      }
      setSnackbar({ open: true, message: '리뷰 삭제 완료 (사용자에게 알림 전송됨)', severity: 'success' });
      loadReviews();
      loadReports();
    } catch (error) {
      setSnackbar({ open: true, message: '삭제 실패', severity: 'error' });
    }
  };

  const handleDismissReport = async (report) => {
    try {
      await updateDoc(doc(db, 'reviewReports', report.id), {
        status: 'dismissed',
        updatedAt: serverTimestamp()
      });
      setSnackbar({ open: true, message: '신고 기각 완료', severity: 'info' });
      setReportDetailDialog(false);
      loadReports();
    } catch (error) {
      setSnackbar({ open: true, message: '처리 실패', severity: 'error' });
    }
  };

  const handleDeleteReported = async (report) => {
    const review = reviews.find(r => r.id === report.reviewId);
    if (review) {
      await handleDelete(review);
    } else {
      // 리뷰가 이미 삭제된 경우
      await updateDoc(doc(db, 'reviewReports', report.id), {
        status: 'resolved',
        resolution: 'already_deleted',
        updatedAt: serverTimestamp()
      });
      setSnackbar({ open: true, message: '리뷰가 이미 삭제됨, 신고 처리 완료', severity: 'info' });
      loadReports();
    }
    setReportDetailDialog(false);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const reportedReviewIds = new Set(
    reports.filter(r => r.status === 'pending').map(r => r.reviewId)
  );

  const filtered = reviews.filter(r => {
    const matchSearch =
      (r.authorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.restaurantName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.text || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.userId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchRating = filterRating === 'all' || Math.floor(r.rating || 0) === Number(filterRating);
    const matchType =
      filterType === 'all' ? true :
      filterType === 'reported' ? reportedReviewIds.has(r.id) :
      filterType === 'edited' ? r.editedByAdmin === true :
      filterType === 'normal' ? !r.editedByAdmin && !reportedReviewIds.has(r.id) :
      true;
    return matchSearch && matchRating && matchType;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">리뷰 관리</Typography>
        <Button startIcon={<Refresh />} onClick={() => { loadReviews(); loadReports(); }} variant="outlined">새로고침</Button>
      </Box>

      {/* 통계 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <Card sx={{ borderRadius: 3, borderLeft: '4px solid #2196F3' }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">전체 리뷰</Typography>
                <Typography variant="h4" fontWeight="bold">{stats.total}</Typography>
              </Box>
              <RateReview sx={{ fontSize: 40, color: '#2196F3', opacity: 0.7 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card sx={{ borderRadius: 3, borderLeft: '4px solid #FF9800' }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">평균 평점</Typography>
                <Typography variant="h4" fontWeight="bold">{stats.avgRating}</Typography>
              </Box>
              <Star sx={{ fontSize: 40, color: '#FF9800', opacity: 0.7 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card sx={{ borderRadius: 3, borderLeft: '4px solid #4CAF50' }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">오늘 리뷰</Typography>
                <Typography variant="h4" fontWeight="bold">{stats.today}</Typography>
              </Box>
              <Edit sx={{ fontSize: 40, color: '#4CAF50', opacity: 0.7 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card
            sx={{
              borderRadius: 3,
              borderLeft: '4px solid #F44336',
              cursor: stats.reported > 0 ? 'pointer' : 'default',
              bgcolor: stats.reported > 0 ? '#FFF5F5' : '#FFF'
            }}
            onClick={() => stats.reported > 0 && setFilterType('reported')}
          >
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">신고된 리뷰</Typography>
                <Typography variant="h4" fontWeight="bold" color={stats.reported > 0 ? '#F44336' : 'inherit'}>
                  {stats.reported}
                </Typography>
              </Box>
              <Flag sx={{ fontSize: 40, color: '#F44336', opacity: 0.7 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 검색/필터 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="작성자, 맛집, 내용 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#999' }} /> }}
          sx={{ width: 350 }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>평점</InputLabel>
          <Select value={filterRating} label="평점" onChange={(e) => setFilterRating(e.target.value)}>
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="5">5점</MenuItem>
            <MenuItem value="4">4점</MenuItem>
            <MenuItem value="3">3점</MenuItem>
            <MenuItem value="2">2점</MenuItem>
            <MenuItem value="1">1점</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>상태</InputLabel>
          <Select value={filterType} label="상태" onChange={(e) => setFilterType(e.target.value)}>
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="reported">신고됨</MenuItem>
            <MenuItem value="edited">수정됨</MenuItem>
            <MenuItem value="normal">정상</MenuItem>
          </Select>
        </FormControl>
        {filterType !== 'all' && (
          <Chip label={`필터: ${filterType}`} onDelete={() => setFilterType('all')} color="primary" />
        )}
        <Chip label={`${filtered.length}건`} />
      </Box>

      {/* 리뷰 테이블 */}
      <Card sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                <TableCell><strong>작성자</strong></TableCell>
                <TableCell><strong>맛집</strong></TableCell>
                <TableCell><strong>평점</strong></TableCell>
                <TableCell><strong>내용</strong></TableCell>
                <TableCell><strong>작성일</strong></TableCell>
                <TableCell><strong>상태</strong></TableCell>
                <TableCell align="center"><strong>관리</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>리뷰가 없습니다</TableCell></TableRow>
              ) : filtered.map((review) => {
                const reviewReports = getReportsForReview(review.id).filter(r => r.status === 'pending');
                return (
                  <TableRow key={review.id} hover sx={{ bgcolor: reviewReports.length > 0 ? '#FFF5F5' : 'inherit' }}>
                    <TableCell sx={{ fontWeight: 600 }}>{review.authorName || review.userId || '-'}</TableCell>
                    <TableCell>{review.restaurantName || '-'}</TableCell>
                    <TableCell><Rating value={review.rating || 0} size="small" readOnly /></TableCell>
                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {review.text || '-'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(review.createdAt)}</TableCell>
                    <TableCell>
                      {reviewReports.length > 0 && (
                        <Chip
                          icon={<Flag />}
                          label={`신고 ${reviewReports.length}건`}
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedReport(reviewReports[0]);
                            setSelectedReview(review);
                            setReportDetailDialog(true);
                          }}
                          sx={{ cursor: 'pointer' }}
                        />
                      )}
                      {review.editedByAdmin && <Chip label="수정됨" size="small" color="warning" sx={{ ml: 0.5 }} />}
                      {!review.editedByAdmin && reviewReports.length === 0 && (
                        <Chip label="정상" size="small" color="success" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="상세보기">
                        <IconButton size="small" onClick={() => { setSelectedReview(review); setDetailDialog(true); }}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="수정">
                        <IconButton size="small" color="primary" onClick={() => handleEdit(review)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="삭제">
                        <IconButton size="small" color="error" onClick={() => handleDelete(review)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 상세보기 */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>리뷰 상세</DialogTitle>
        <DialogContent>
          {selectedReview && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom><strong>작성자:</strong> {selectedReview.authorName || selectedReview.userId || '-'}</Typography>
              <Typography variant="body2" gutterBottom><strong>맛집:</strong> {selectedReview.restaurantName || '-'}</Typography>
              <Typography variant="body2" gutterBottom>
                <strong>평점:</strong> <Rating value={selectedReview.rating || 0} size="small" readOnly sx={{ verticalAlign: 'middle' }} />
              </Typography>
              <Typography variant="body2" gutterBottom><strong>작성일:</strong> {formatDate(selectedReview.createdAt)}</Typography>
              {selectedReview.updatedAt && (
                <Typography variant="body2" gutterBottom><strong>수정일:</strong> {formatDate(selectedReview.updatedAt)}</Typography>
              )}
              {selectedReview.editedByAdmin && (
                <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>관리자에 의해 수정된 리뷰입니다</Alert>
              )}
              <Typography variant="body2" sx={{ mt: 2, p: 2, bgcolor: '#F5F6FA', borderRadius: 2 }}>
                {selectedReview.text || '내용 없음'}
              </Typography>
              {selectedReview.photos && selectedReview.photos.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {selectedReview.photos.map((photo, i) => (
                    <img key={i} src={photo} alt={`리뷰 사진 ${i + 1}`} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </Box>
              )}
              {/* 이 리뷰의 신고 내역 */}
              {getReportsForReview(selectedReview.id).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>신고 내역</Typography>
                  {getReportsForReview(selectedReview.id).map((report) => (
                    <Alert
                      key={report.id}
                      severity={report.status === 'pending' ? 'error' : 'info'}
                      sx={{ mb: 1 }}
                    >
                      <strong>사유:</strong> {report.reason} | <strong>상태:</strong> {report.status} | <strong>신고일:</strong> {formatDate(report.createdAt)}
                    </Alert>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>닫기</Button>
          <Button color="primary" startIcon={<Edit />} onClick={() => { setDetailDialog(false); handleEdit(selectedReview); }}>수정</Button>
          <Button color="error" startIcon={<Delete />} onClick={() => { setDetailDialog(false); handleDelete(selectedReview); }}>삭제</Button>
        </DialogActions>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>리뷰 수정</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {selectedReview && (
            <>
              <Typography variant="body2" gutterBottom><strong>작성자:</strong> {selectedReview.authorName || selectedReview.userId}</Typography>
              <Typography variant="body2" gutterBottom><strong>맛집:</strong> {selectedReview.restaurantName}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, mt: 2 }}>
                <Typography variant="body2"><strong>평점:</strong></Typography>
                <Rating value={editForm.rating} onChange={(e, v) => setEditForm({ ...editForm, rating: v })} />
              </Box>
              <TextField fullWidth multiline rows={4} label="리뷰 내용" value={editForm.text}
                onChange={(e) => setEditForm({ ...editForm, text: e.target.value })} />
              <Alert severity="info" sx={{ mt: 2 }}>수정 시 작성자에게 알림이 전송됩니다</Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveEdit} sx={{ bgcolor: '#FF6B6B' }}>수정 저장</Button>
        </DialogActions>
      </Dialog>

      {/* 신고 처리 다이얼로그 */}
      <Dialog open={reportDetailDialog} onClose={() => setReportDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Flag color="error" /> 신고 리뷰 처리
        </DialogTitle>
        <DialogContent>
          {selectedReport && selectedReview && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                이 리뷰에 대한 신고가 접수되었습니다
              </Alert>

              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>리뷰 내용</Typography>
              <Box sx={{ p: 2, bgcolor: '#F5F6FA', borderRadius: 2, mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>작성자:</strong> {selectedReview.authorName || selectedReview.userId || '-'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>맛집:</strong> {selectedReview.restaurantName || '-'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>평점:</strong> <Rating value={selectedReview.rating || 0} size="small" readOnly sx={{ verticalAlign: 'middle' }} />
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>{selectedReview.text || '내용 없음'}</Typography>
              </Box>

              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>신고 정보</Typography>
              {getReportsForReview(selectedReview.id).filter(r => r.status === 'pending').map((report) => (
                <Box key={report.id} sx={{ p: 2, bgcolor: '#FFF5F5', borderRadius: 2, mb: 1, border: '1px solid #FFCDD2' }}>
                  <Typography variant="body2"><strong>신고 사유:</strong> {report.reason}</Typography>
                  <Typography variant="body2"><strong>신고자:</strong> {report.reporterId || '-'}</Typography>
                  <Typography variant="body2"><strong>신고일:</strong> {formatDate(report.createdAt)}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setReportDetailDialog(false)} color="inherit">닫기</Button>
          <Button
            variant="contained"
            color="info"
            startIcon={<Cancel />}
            onClick={() => {
              const pendingReports = getReportsForReview(selectedReview.id).filter(r => r.status === 'pending');
              pendingReports.forEach(r => handleDismissReport(r));
            }}
          >
            신고 기각 (문제없음)
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<Delete />}
            onClick={() => handleDeleteReported(selectedReport)}
          >
            리뷰 삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
