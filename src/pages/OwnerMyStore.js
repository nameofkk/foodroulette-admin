import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Chip,
  CircularProgress, Grid, List, ListItemButton, ListItemText,
  Checkbox, FormControlLabel, Divider, Stepper, Step, StepLabel
} from '@mui/material';
import {
  Store, Search, Campaign, Edit, Phone, LocationOn, Delete,
  Visibility, TrendingUp, CardGiftcard, Star, CheckCircle
} from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp
} from 'firebase/firestore';
import { auth } from '../firebase';
import { searchKakaoPlaces as searchKakaoAPI, registerStore, getSponsorStatus } from '../services/storeService';

const SPONSOR_BENEFITS = [
  { icon: <Visibility sx={{ fontSize: 40, color: '#9C27B0' }} />, title: '룰렛 우선 노출', desc: '일반 매장보다 최대 3배 더 자주 노출' },
  { icon: <CardGiftcard sx={{ fontSize: 40, color: '#4CAF50' }} />, title: '보너스 포인트 지급', desc: '방문 고객에게 추가 포인트 지급으로 재방문 유도' },
  { icon: <TrendingUp sx={{ fontSize: 40, color: '#2196F3' }} />, title: '상세 통계 제공', desc: '노출·클릭·방문 전환율 데이터 실시간 확인' },
  { icon: <Star sx={{ fontSize: 40, color: '#FF9800' }} />, title: '스폰서 뱃지', desc: '맛집카드에 스폰서 마크로 신뢰도 UP' },
];

export default function OwnerMyStore({ role }) {
  const [myStores, setMyStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchDialog, setSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [editForm, setEditForm] = useState({ phone: '', description: '' });
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 스폰서 신청 (스텝 방식)
  const [sponsorDialog, setSponsorDialog] = useState(false);
  const [sponsorStep, setSponsorStep] = useState(0);
  const [sponsorForm, setSponsorForm] = useState({
    businessName: '',
    businessNumber: '',
    representativeName: '',
    representativePhone: '',
    businessAddress: '',
    businessType: '',
    agreeTerms: false,
    agreePrivacy: false,
    agreeRefund: false,
  });

  useEffect(() => { loadMyStores(); }, []);

  const loadMyStores = async () => {
    setLoading(true);
    try {
      const userEmail = auth.currentUser?.email || '';
      const q = query(collection(db, 'ownerStores'), where('ownerEmail', '==', userEmail));
      const snap = await getDocs(q);
      setMyStores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('가게 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchKakao = async () => {
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
      setSnackbar({ open: true, message: '등록 실패', severity: 'error' });
    }
  };

  const handleEditSave = async () => {
    if (!selectedStore) return;
    try {
      await updateDoc(doc(db, 'ownerStores', selectedStore.id), {
        phone: editForm.phone,
        description: editForm.description,
        updatedAt: serverTimestamp()
      });
      setEditDialog(false);
      setSnackbar({ open: true, message: '수정 완료', severity: 'success' });
      loadMyStores();
    } catch (error) {
      setSnackbar({ open: true, message: '수정 실패', severity: 'error' });
    }
  };

  const handleDeleteStore = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'ownerStores', deleteTarget.id));
      setDeleteDialog(false);
      setDeleteTarget(null);
      setSnackbar({ open: true, message: `${deleteTarget.name} 삭제 완료`, severity: 'success' });
      loadMyStores();
    } catch (error) {
      setSnackbar({ open: true, message: '삭제 실패: ' + error.message, severity: 'error' });
    }
  };

  const openSponsorDialog = (store) => {
    setSelectedStore(store);
    setSponsorStep(0);
    setSponsorForm({
      businessName: store.name || '',
      businessNumber: '',
      representativeName: '',
      representativePhone: '',
      businessAddress: store.address || '',
      businessType: store.category || '',
      agreeTerms: false,
      agreePrivacy: false,
      agreeRefund: false,
    });
    setSponsorDialog(true);
  };

  const canProceedStep = () => {
    if (sponsorStep === 0) return true; // 혜택 안내는 그냥 넘어감
    if (sponsorStep === 1) {
      return sponsorForm.businessName.trim() &&
        sponsorForm.businessNumber.trim() &&
        sponsorForm.representativeName.trim() &&
        sponsorForm.representativePhone.trim();
    }
    if (sponsorStep === 2) {
      return sponsorForm.agreeTerms && sponsorForm.agreePrivacy && sponsorForm.agreeRefund;
    }
    return false;
  };

  const handleSponsorSubmit = async () => {
    if (!selectedStore) return;
    try {
      await addDoc(collection(db, 'sponsorApplications'), {
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        kakaoPlaceId: selectedStore.kakaoPlaceId,
        ownerEmail: auth.currentUser?.email || '',
        ownerId: auth.currentUser?.uid || '',
        // 사업자 정보
        businessName: sponsorForm.businessName,
        businessNumber: sponsorForm.businessNumber,
        representativeName: sponsorForm.representativeName,
        representativePhone: sponsorForm.representativePhone,
        businessAddress: sponsorForm.businessAddress,
        businessType: sponsorForm.businessType,
        // 동의 내역
        agreedTerms: true,
        agreedPrivacy: true,
        agreedRefund: true,
        agreedAt: serverTimestamp(),
        // 상태
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'ownerStores', selectedStore.id), {
        sponsorStatus: 'pending',
        updatedAt: serverTimestamp()
      });
      setSponsorDialog(false);
      setSnackbar({ open: true, message: '스폰서 신청이 접수되었습니다. 심사 후 결과를 알려드립니다.', severity: 'success' });
      loadMyStores();
    } catch (error) {
      setSnackbar({ open: true, message: '신청 실패: ' + error.message, severity: 'error' });
    }
  };

  const getSponsorChip = (status) => {
    const s = getSponsorStatus(status);
    return <Chip label={s.label} color={s.color} size="small" />;
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#FF6B6B' }} /></Box>;
  }

  const hasSponsorStore = myStores.some(s => s.sponsorStatus === 'approved');
  const hasNonSponsorStore = myStores.some(s => s.sponsorStatus !== 'approved' && s.sponsorStatus !== 'pending');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">내 가게 관리</Typography>
        <Button startIcon={<Search />} onClick={() => setSearchDialog(true)} variant="contained"
          sx={{ bgcolor: '#FF6B6B', '&:hover': { bgcolor: '#FF4757' } }}>
          카카오맵에서 내 가게 찾기
        </Button>
      </Box>

      {myStores.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Store sx={{ fontSize: 64, color: '#DDD', mb: 2 }} />
          {role === 'admin' ? (
            <>
              <Typography variant="h6" color="text.secondary" gutterBottom>관리자 모드</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>관리자 계정에는 연결된 가게가 없습니다.</Typography>
              <Typography variant="body2" color="text.secondary">사장님 화면을 테스트하려면 가게를 등록하세요.</Typography>
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
          {/* 스폰서 프로모션 배너 — 스폰서 아닌 가게가 있을 때만 */}
{hasNonSponsorStore && (
  <Card sx={{
    mb: 3, borderRadius: 3, overflow: 'hidden',
    bgcolor: '#1A1A2E', color: '#FFF', position: 'relative',
  }}>
    <CardContent sx={{ p: 4, textAlign: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1.5 }}>
        <Campaign sx={{ fontSize: 32, color: '#FFD93D' }} />
        <Typography variant="h5" fontWeight="bold" sx={{ color: '#FFF' }}>
          스폰서가 되면 매출이 달라집니다
        </Typography>
      </Box>
      <Typography variant="body1" sx={{ color: '#CCC', mb: 3 }}>
        룰렛 우선 노출 + 보너스 포인트 지급 + 상세 통계 — 지금 바로 신청하세요!
      </Typography>
      <Grid container spacing={2} justifyContent="center">
        {SPONSOR_BENEFITS.map((b, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, p: 2,
              textAlign: 'center', height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              {React.cloneElement(b.icon, { sx: { fontSize: 36, color: '#FFD93D' } })}
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1, color: '#FFF' }}>{b.title}</Typography>
              <Typography variant="caption" sx={{ color: '#AAA' }}>{b.desc}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </CardContent>
  </Card>
)}

          {/* 가게 카드 목록 */}
          <Grid container spacing={2}>
            {myStores.map((store) => {
              const isSponsor = store.sponsorStatus === 'approved';
              const isPending = store.sponsorStatus === 'pending';
              const canApply = !isSponsor && !isPending;

              return (
                <Grid item xs={12} md={6} key={store.id}>
                  <Card sx={{
                    borderRadius: 3, p: 2,
                    border: isSponsor ? '2px solid #FF9800' : '1px solid #EEE',
                    position: 'relative',
                  }}>
                    {isSponsor && (
                      <Chip label="⭐ 스폰서" size="small"
                        sx={{
                          position: 'absolute', top: 12, right: 12,
                          bgcolor: '#FF9800', color: '#FFF', fontWeight: 700,
                        }} />
                    )}
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold">{store.name}</Typography>
                        {!isSponsor && getSponsorChip(store.sponsorStatus)}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LocationOn sx={{ fontSize: 18, color: '#999' }} />
                        <Typography variant="body2" color="text.secondary">{store.address || '-'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Phone sx={{ fontSize: 18, color: '#999' }} />
                        <Typography variant="body2" color="text.secondary">{store.phone || '-'}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        카카오 ID: {store.kakaoPlaceId || '-'} | {store.category || '-'}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button size="small" startIcon={<Edit />} onClick={() => {
                          setSelectedStore(store);
                          setEditForm({ phone: store.phone || '', description: store.description || '' });
                          setEditDialog(true);
                        }}>정보 수정</Button>

                        {canApply && (
                          <Button size="small" variant="contained" startIcon={<Campaign />}
                            onClick={() => openSponsorDialog(store)}
                            sx={{
                              bgcolor: '#FF9800', '&:hover': { bgcolor: '#F57C00' },
                              fontWeight: 700, animation: 'pulse 2s infinite',
                              '@keyframes pulse': {
                                '0%': { boxShadow: '0 0 0 0 rgba(255,152,0,0.4)' },
                                '70%': { boxShadow: '0 0 0 8px rgba(255,152,0,0)' },
                                '100%': { boxShadow: '0 0 0 0 rgba(255,152,0,0)' },
                              }
                            }}>
                            스폰서 신청하기
                          </Button>
                        )}

                        {isPending && (
                          <Chip label="심사 진행 중" color="warning" size="small"
                            icon={<CircularProgress size={14} sx={{ color: '#FFF' }} />} />
                        )}

                        <Button size="small" color="error" startIcon={<Delete />} onClick={() => {
                          setDeleteTarget(store);
                          setDeleteDialog(true);
                        }}>삭제</Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* 카카오 검색 다이얼로그 */}
      <Dialog open={searchDialog} onClose={() => setSearchDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>카카오맵에서 내 가게 찾기</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
            <TextField fullWidth size="small" placeholder="가게명으로 검색"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchKakao()} />
            <Button variant="contained" onClick={searchKakao} disabled={searching}
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
                    secondary={`${place.road_address_name || place.address_name} ${place.phone ? '| ' + place.phone : ''}`}
                  />
                  <Chip label="등록" size="small" color="primary" />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSearchDialog(false)}>닫기</Button></DialogActions>
      </Dialog>

      {/* 정보 수정 */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>가게 정보 수정</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField fullWidth label="전화번호" value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="가게 설명" multiline rows={3} value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleEditSave} sx={{ bgcolor: '#FF6B6B' }}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* 가게 삭제 */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>가게 삭제</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>삭제하면 스폰서 신청 내역도 함께 무효화됩니다.</Alert>
          <Typography variant="body1"><strong>{deleteTarget?.name}</strong>을(를) 정말 삭제하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialog(false)}>취소</Button>
          <Button variant="contained" color="error" startIcon={<Delete />} onClick={handleDeleteStore}>삭제</Button>
        </DialogActions>
      </Dialog>

      {/* 스폰서 신청 다이얼로그 (3단계 스텝) */}
      <Dialog open={sponsorDialog} onClose={() => setSponsorDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 0 }}>
          <Typography variant="h6" fontWeight="bold">스폰서 신청</Typography>
          <Typography variant="body2" color="text.secondary">{selectedStore?.name}</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stepper activeStep={sponsorStep} sx={{ mb: 3 }}>
            <Step><StepLabel>혜택 안내</StepLabel></Step>
            <Step><StepLabel>사업자 정보</StepLabel></Step>
            <Step><StepLabel>약관 동의</StepLabel></Step>
          </Stepper>

          {/* STEP 0: 혜택 안내 */}
{sponsorStep === 0 && (
  <Box>
    <Alert severity="info" sx={{ mb: 3 }}>
      스폰서가 되시면 아래 혜택을 모두 이용하실 수 있습니다.
    </Alert>
    <Grid container spacing={2}>
      {SPONSOR_BENEFITS.map((b, i) => (
        <Grid item xs={6} key={i}>
          <Card variant="outlined" sx={{
            p: 2, height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center',
          }}>
            {b.icon}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>{b.title}</Typography>
            <Typography variant="body2" color="text.secondary">{b.desc}</Typography>
          </Card>
        </Grid>
      ))}
    </Grid>
    <Alert severity="info" sx={{ mt: 3 }}>
      노출 레벨에 따라 월 10,000P ~ 50,000P의 이용료가 발생합니다.
      스폰서 승인 후 "스폰서 매장 관리"에서 레벨을 선택하실 수 있습니다.
    </Alert>
  </Box>
)}

          {/* STEP 1: 사업자 정보 */}
          {sponsorStep === 1 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                정산 및 세금계산서 발행을 위해 사업자 정보가 필요합니다.
              </Alert>
              <TextField fullWidth label="상호명 (사업자등록증 기준)" value={sponsorForm.businessName}
                onChange={(e) => setSponsorForm({ ...sponsorForm, businessName: e.target.value })}
                sx={{ mb: 2 }} required />
              <TextField fullWidth label="사업자등록번호" value={sponsorForm.businessNumber}
                onChange={(e) => setSponsorForm({ ...sponsorForm, businessNumber: e.target.value })}
                sx={{ mb: 2 }} required placeholder="000-00-00000"
                helperText="하이픈(-) 포함하여 입력해주세요" />
              <TextField fullWidth label="대표자명" value={sponsorForm.representativeName}
                onChange={(e) => setSponsorForm({ ...sponsorForm, representativeName: e.target.value })}
                sx={{ mb: 2 }} required />
              <TextField fullWidth label="대표자 연락처" value={sponsorForm.representativePhone}
                onChange={(e) => setSponsorForm({ ...sponsorForm, representativePhone: e.target.value })}
                sx={{ mb: 2 }} required placeholder="010-0000-0000" />
              <TextField fullWidth label="사업장 소재지" value={sponsorForm.businessAddress}
                onChange={(e) => setSponsorForm({ ...sponsorForm, businessAddress: e.target.value })}
                sx={{ mb: 2 }} />
              <TextField fullWidth label="업종/업태" value={sponsorForm.businessType}
                onChange={(e) => setSponsorForm({ ...sponsorForm, businessType: e.target.value })} />
            </Box>
          )}

          {/* STEP 2: 약관 동의 */}
          {sponsorStep === 2 && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                스폰서 서비스 이용을 위해 아래 약관에 동의해주세요.
              </Alert>

              <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                <FormControlLabel
                  control={<Checkbox checked={sponsorForm.agreeTerms}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, agreeTerms: e.target.checked })} />}
                  label={<Typography fontWeight="bold">[필수] 스폰서 서비스 이용약관</Typography>}
                />
                <Box sx={{ bgcolor: '#F9F9F9', borderRadius: 1, p: 2, maxHeight: 120, overflow: 'auto', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                    {`제1조 (목적)
본 약관은 FoodRoulette(이하 "회사")가 제공하는 스폰서 광고 서비스의 이용 조건 및 절차를 규정합니다.

제2조 (서비스 내용)
1. 룰렛 우선 노출 서비스
2. 방문 인증 보너스 포인트 지급 대행
3. 노출/클릭/방문 통계 리포트 제공
4. 맛집카드 스폰서 뱃지 표시

제3조 (이용 요금)
1. 기본 플랜: 월 10,000P
2. 프리미엄 플랜: 월 30,000P
3. VIP 플랜: 월 50,000P
4. 요금은 충전 포인트에서 차감됩니다.

제4조 (계약 기간)
1. 스폰서 계약은 월 단위로 자동 갱신됩니다.
2. 해지는 언제든 가능하며, 잔여 기간에 대한 환불은 제6조를 따릅니다.`}
                  </Typography>
                </Box>
              </Card>

              <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                <FormControlLabel
                  control={<Checkbox checked={sponsorForm.agreePrivacy}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, agreePrivacy: e.target.checked })} />}
                  label={<Typography fontWeight="bold">[필수] 개인정보 수집 및 이용 동의</Typography>}
                />
                <Box sx={{ bgcolor: '#F9F9F9', borderRadius: 1, p: 2, maxHeight: 120, overflow: 'auto', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                    {`수집 항목: 상호명, 사업자등록번호, 대표자명, 연락처, 사업장 주소
수집 목적: 스폰서 서비스 제공, 정산 처리, 세금계산서 발행, 서비스 관련 안내
보유 기간: 서비스 해지 후 5년 (전자상거래법)
동의를 거부할 권리가 있으며, 거부 시 스폰서 서비스 이용이 제한됩니다.`}
                  </Typography>
                </Box>
              </Card>

              <Card variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={<Checkbox checked={sponsorForm.agreeRefund}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, agreeRefund: e.target.checked })} />}
                  label={<Typography fontWeight="bold">[필수] 환불 정책 동의</Typography>}
                />
                <Box sx={{ bgcolor: '#F9F9F9', borderRadius: 1, p: 2, maxHeight: 120, overflow: 'auto', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                    {`1. 충전 포인트 환불: 미사용 포인트에 한해 환불 가능 (수수료 10% 차감)
2. 스폰서 플랜 환불: 결제일로부터 7일 이내 미사용 시 전액 환불
3. 이미 노출/사용된 서비스에 대해서는 환불이 불가합니다.
4. 환불 처리 기간: 요청일로부터 영업일 기준 5~7일`}
                  </Typography>
                </Box>
              </Card>

              <Box sx={{ mt: 2 }}>
                <Button size="small" onClick={() => {
                  setSponsorForm({ ...sponsorForm, agreeTerms: true, agreePrivacy: true, agreeRefund: true });
                }}>전체 동의</Button>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => {
            if (sponsorStep > 0) setSponsorStep(sponsorStep - 1);
            else setSponsorDialog(false);
          }}>
            {sponsorStep === 0 ? '취소' : '이전'}
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {sponsorStep < 2 ? (
              <Button variant="contained" onClick={() => setSponsorStep(sponsorStep + 1)}
                disabled={!canProceedStep()}
                sx={{ bgcolor: '#FF6B6B' }}>
                다음
              </Button>
            ) : (
              <Button variant="contained" onClick={handleSponsorSubmit}
                disabled={!canProceedStep()}
                startIcon={<CheckCircle />}
                sx={{ bgcolor: '#FF6B6B' }}>
                스폰서 신청 완료
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
