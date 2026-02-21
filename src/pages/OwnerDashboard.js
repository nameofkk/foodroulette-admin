import React, { useState, useEffect } from 'react';
import { searchKakaoPlaces as searchKakaoAPI, registerStore, getSponsorStatus } from '../services/storeService';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar, CircularProgress, Rating,
  List, ListItemButton, ListItemText
} from '@mui/material';
import {
  Store, Visibility, People, Star,
  Edit, Campaign, Refresh, Search
} from '@mui/icons-material';
import { db, auth } from '../firebase';
import {
  collection, getDocs, addDoc, updateDoc, doc, query,
  where, orderBy, serverTimestamp, limit
} from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

export default function OwnerDashboard({ role }) {
  const [myStores, setMyStores] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sponsorDialog, setSponsorDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [sponsorForm, setSponsorForm] = useState({ bonusPoints: 3000, bonusMultiplier: 1.5, contractMonths: 1 });
  const [searchDialog, setSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState({ totalVisits: 0, totalReviews: 0, avgRating: 0, rouletteAppearances: 0 });
  const [chartData, setChartData] = useState([]);
  const [allVisits, setAllVisits] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMyStores(); }, []);

  useEffect(() => {
    if (allVisits.length > 0 || allReviews.length > 0) {
      buildChartData(allVisits, allReviews);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const loadMyStores = async () => {
    setLoading(true);
    try {
      const userEmail = auth.currentUser?.email || '';
      const q = query(collection(db, 'ownerStores'), where('ownerEmail', '==', userEmail));
      const snap = await getDocs(q);
      const stores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyStores(stores);
      if (stores.length > 0) await loadStoreData(stores);
    } catch (error) {
      console.error('가게 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreData = async (stores) => {
    try {
      const storeIds = stores.map(s => String(s.kakaoPlaceId || s.id));
      let visits = [];
      let revs = [];

      for (const storeId of storeIds) {
        try {
          const rq = query(collection(db, 'reviews'), where('restaurantId', '==', storeId), orderBy('createdAt', 'desc'), limit(50));
          const rSnap = await getDocs(rq);
          revs = [...revs, ...rSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }))];
        } catch (e) {}

        try {
          const vq = query(collection(db, 'visits'), where('restaurantId', '==', storeId), orderBy('createdAt', 'desc'), limit(100));
          const vSnap = await getDocs(vq);
          visits = [...visits, ...vSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }))];
        } catch (e) {}
      }

      setReviews(revs);
      setAllVisits(visits);
      setAllReviews(revs);

      const avgRating = revs.length > 0
        ? (revs.reduce((sum, r) => sum + (r.rating || 0), 0) / revs.length).toFixed(1) : 0;

      // 실제 룰렛 노출 수 조회
      let rouletteCount = 0;
      for (const storeId of storeIds) {
        try {
          const rouletteQ = query(collection(db, 'rouletteAppearances'), where('restaurantId', '==', storeId));
          const rSnap = await getDocs(rouletteQ);
          rouletteCount += rSnap.size;
        } catch (e) {}
      }

      setStats({
        totalVisits: visits.length, totalReviews: revs.length,
        avgRating: Number(avgRating), rouletteAppearances: rouletteCount
      });

      buildChartData(visits, revs);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  const buildChartData = (visits, revs) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const data = [];

    for (let i = 0; i < diffDays && i < 31; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      data.push({
        name: `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`,
        방문: visits.filter(v => { const d = new Date(v.createdAt); return d >= date && d < nextDate; }).length,
        리뷰: revs.filter(r => { const d = new Date(r.createdAt); return d >= date && d < nextDate; }).length,
      });
    }
    setChartData(data);
  };

  const searchKakaoPlaces = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchKakaoAPI(searchQuery);
      setSearchResults(results);
    } catch (error) {
      setSnackbar({ open: true, message: '검색 실패', severity: 'error' });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPlace = async (place) => {
    try {
      const result = await registerStore(place);
      if (!result.success) {
        setSnackbar({ open: true, message: result.message, severity: 'warning' });
        return;
      }
      setSearchDialog(false);
      setSearchQuery('');
      setSearchResults([]);
      setSnackbar({ open: true, message: result.message, severity: 'success' });
      loadMyStores();
    } catch (error) {
      setSnackbar({ open: true, message: '등록 실패: ' + error.message, severity: 'error' });
    }
  };

  const handleSponsorApply = async () => {
    if (!selectedStore) return;
    try {
      await addDoc(collection(db, 'sponsorApplications'), {
        storeId: selectedStore.id, storeName: selectedStore.name,
        kakaoPlaceId: selectedStore.kakaoPlaceId,
        ownerEmail: auth.currentUser?.email || '',
        ...sponsorForm, status: 'pending', createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'ownerStores', selectedStore.id), {
        sponsorStatus: 'pending', updatedAt: serverTimestamp()
      });
      setSponsorDialog(false);
      setSnackbar({ open: true, message: '스폰서 신청이 접수되었습니다', severity: 'success' });
      loadMyStores();
    } catch (error) {
      setSnackbar({ open: true, message: '신청 실패: ' + error.message, severity: 'error' });
    }
  };

  const getSponsorChip = (status) => {
    const s = getSponsorStatus(status);
    return <Chip label={s.label} color={s.color} size="small" />;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><CircularProgress sx={{ color: '#FF6B6B' }} /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">사장님 대시보드</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={loadMyStores} variant="outlined">새로고침</Button>
          <Button startIcon={<Search />} onClick={() => setSearchDialog(true)} variant="contained"
            sx={{ bgcolor: '#FF6B6B', '&:hover': { bgcolor: '#FF4757' } }}>
            카카오맵에서 내 가게 찾기
          </Button>
        </Box>
      </Box>

      {myStores.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Store sx={{ fontSize: 64, color: '#DDD', mb: 2 }} />
          {role === 'admin' ? (
            <>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                관리자 모드
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                관리자 계정에는 연결된 가게가 없습니다.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                사장님 화면을 테스트하려면 가게를 등록하세요.
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h6" color="text.secondary" gutterBottom>등록된 가게가 없습니다</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>카카오맵에서 내 가게를 검색해서 등록하세요</Typography>
              <Button variant="contained" startIcon={<Search />} onClick={() => setSearchDialog(true)}
                sx={{ bgcolor: '#FF6B6B' }}>카카오맵에서 내 가게 찾기</Button>
            </>
          )}
        </Card>

      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={3}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <People sx={{ fontSize: 36, color: '#4CAF50' }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{stats.totalVisits}</Typography>
                  <Typography variant="body2" color="text.secondary">총 방문 인증</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={3}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Star sx={{ fontSize: 36, color: '#FF9800' }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{stats.avgRating}</Typography>
                  <Typography variant="body2" color="text.secondary">평균 평점</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={3}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Edit sx={{ fontSize: 36, color: '#2196F3' }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{stats.totalReviews}</Typography>
                  <Typography variant="body2" color="text.secondary">총 리뷰</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={3}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Visibility sx={{ fontSize: 36, color: '#9C27B0' }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{stats.rouletteAppearances}</Typography>
                  <Typography variant="body2" color="text.secondary">룰렛 노출</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">활동 그래프</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField type="date" size="small" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} sx={{ width: 160 }} />
                <Typography variant="body2">~</Typography>
                <TextField type="date" size="small" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)} sx={{ width: 160 }} />
                <Button size="small" variant="outlined" onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 6);
                  setStartDate(d.toISOString().split('T')[0]);
                  setEndDate(new Date().toISOString().split('T')[0]);
                }}>7일</Button>
                <Button size="small" variant="outlined" onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 29);
                  setStartDate(d.toISOString().split('T')[0]);
                  setEndDate(new Date().toISOString().split('T')[0]);
                }}>30일</Button>
              </Box>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="방문" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                <Bar dataKey="리뷰" fill="#2196F3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>내 가게</Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                      <TableCell><strong>가게명</strong></TableCell>
                      <TableCell><strong>카테고리</strong></TableCell>
                      <TableCell><strong>주소</strong></TableCell>
                      <TableCell><strong>카카오 ID</strong></TableCell>
                      <TableCell><strong>스폰서</strong></TableCell>
                      <TableCell align="center"><strong>관리</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {myStores.map((store) => (
                      <TableRow key={store.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{store.name}</TableCell>
                        <TableCell>{store.category || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {store.address || '-'}
                        </TableCell>
                        <TableCell><Chip label={store.kakaoPlaceId || '-'} size="small" variant="outlined" /></TableCell>
                        <TableCell>{getSponsorChip(store.sponsorStatus)}</TableCell>
                        <TableCell align="center">
                          {store.sponsorStatus !== 'approved' && store.sponsorStatus !== 'pending' && (
                            <Button size="small" color="warning" startIcon={<Campaign />} onClick={() => {
                              setSelectedStore(store); setSponsorDialog(true);
                            }}>스폰서 신청</Button>
                          )}
                          {store.sponsorStatus === 'pending' && <Chip label="심사중" color="warning" size="small" />}
                          {store.sponsorStatus === 'approved' && <Chip label="스폰서 활성" color="success" size="small" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>최근 리뷰</Typography>
              {reviews.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>아직 리뷰가 없습니다</Typography>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                        <TableCell><strong>작성자</strong></TableCell>
                        <TableCell><strong>평점</strong></TableCell>
                        <TableCell><strong>내용</strong></TableCell>
                        <TableCell><strong>날짜</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reviews.slice(0, 10).map((review) => (
                        <TableRow key={review.id} hover>
                          <TableCell>{review.authorName || '-'}</TableCell>
                          <TableCell><Rating value={review.rating || 0} size="small" readOnly /></TableCell>
                          <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {review.text || '-'}
                          </TableCell>
                          <TableCell>{formatDate(review.createdAt)}</TableCell>
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

      {/* 카카오맵 검색 */}
      <Dialog open={searchDialog} onClose={() => setSearchDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>카카오맵에서 내 가게 찾기</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
            <TextField fullWidth size="small" placeholder="가게명으로 검색 (예: 강남 돈까스)"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchKakaoPlaces()} />
            <Button variant="contained" onClick={searchKakaoPlaces} disabled={searching}
              sx={{ bgcolor: '#FF6B6B', minWidth: 80 }}>
              {searching ? <CircularProgress size={20} color="inherit" /> : '검색'}
            </Button>
          </Box>
          {searchResults.length > 0 && (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {searchResults.map((place) => (
                <ListItemButton key={place.id} onClick={() => handleSelectPlace(place)}
                  sx={{ borderRadius: 2, mb: 0.5, border: '1px solid #EEE' }}>
                  <ListItemText
                    primary={<Typography fontWeight="bold">{place.place_name}</Typography>}
                    secondary={<><Typography variant="caption" color="text.secondary">{place.road_address_name || place.address_name}</Typography><br /><Typography variant="caption" color="text.secondary">{place.category_name} {place.phone && `| ${place.phone}`}</Typography></>}
                  />
                  <Chip label="등록" size="small" color="primary" />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSearchDialog(false)}>닫기</Button></DialogActions>
      </Dialog>

      {/* 스폰서 신청 */}
      <Dialog open={sponsorDialog} onClose={() => setSponsorDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>스폰서 신청</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Alert severity="info" sx={{ mb: 2 }}>스폰서가 되면 룰렛에서 우선 노출되고, 방문 인증 시 추가 보너스 포인트가 지급됩니다.</Alert>
          <Typography variant="body2" gutterBottom><strong>가게:</strong> {selectedStore?.name}</Typography>
          <Typography variant="body2" gutterBottom><strong>카카오 ID:</strong> {selectedStore?.kakaoPlaceId}</Typography>
          <TextField fullWidth label="보너스 포인트" type="number" value={sponsorForm.bonusPoints}
            onChange={(e) => setSponsorForm({ ...sponsorForm, bonusPoints: Number(e.target.value) })} sx={{ mb: 2, mt: 2 }}
            helperText="방문 인증 시 추가로 지급되는 포인트" />
          <TextField fullWidth label="보너스 배율" type="number" value={sponsorForm.bonusMultiplier}
            onChange={(e) => setSponsorForm({ ...sponsorForm, bonusMultiplier: Number(e.target.value) })} sx={{ mb: 2 }}
            helperText="기본 포인트에 곱해지는 배율" inputProps={{ step: 0.1 }} />
          <TextField fullWidth label="계약 기간 (개월)" type="number" value={sponsorForm.contractMonths}
            onChange={(e) => setSponsorForm({ ...sponsorForm, contractMonths: Number(e.target.value) })} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSponsorDialog(false)}>취소</Button>
          <Button variant="contained" color="warning" onClick={handleSponsorApply} startIcon={<Campaign />}>신청하기</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
