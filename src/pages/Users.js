import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
  Tabs, Tab, Rating, Grid, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import {
  Refresh, Search, Block, Notifications, Visibility,
  Delete, Person, CardGiftcard
} from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, getDocs, updateDoc, deleteDoc, addDoc, doc, query,
  where, orderBy, limit, serverTimestamp, increment
} from 'firebase/firestore';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userVisits, setUserVisits] = useState([]);
  const [userReviews, setUserReviews] = useState([]);
  const [detailTab, setDetailTab] = useState(0);
  const [notifyDialog, setNotifyDialog] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [pointDialog, setPointDialog] = useState(false);
  const [pointAmount, setPointAmount] = useState('');
  const [pointReason, setPointReason] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const items = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || d.data().updatedAt?.toDate?.() || new Date()
      }));
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUsers(items);
    } catch (error) {
      console.error('사용자 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetail = async (user) => {
    setSelectedUser(user);
    setDetailTab(0);
    setDetailDialog(true);

    try {
      const visitsSnap = await getDocs(
        query(collection(db, 'users', user.id, 'visits'), orderBy('createdAt', 'desc'), limit(50))
      );
      setUserVisits(visitsSnap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      })));
    } catch (e) {
      setUserVisits([]);
    }

    try {
      const reviewsSnap = await getDocs(
        query(collection(db, 'reviews'), where('userId', '==', user.id), orderBy('createdAt', 'desc'), limit(50))
      );
      setUserReviews(reviewsSnap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      })));
    } catch (e) {
      setUserReviews([]);
    }
  };

  const handleBlockUser = async (user) => {
    const isBlocked = user.blocked === true;
    const action = isBlocked ? '차단 해제' : '차단';
    if (!window.confirm(`${user.nickname || user.id}을(를) ${action}하시겠습니까?`)) return;

    try {
      await updateDoc(doc(db, 'users', user.id), {
        blocked: !isBlocked,
        updatedAt: serverTimestamp()
      });
      setSnackbar({ open: true, message: `${action} 완료`, severity: isBlocked ? 'success' : 'warning' });
      loadUsers();
    } catch (error) {
      setSnackbar({ open: true, message: `${action} 실패`, severity: 'error' });
    }
  };

  const handleSendNotify = async () => {
    if (!selectedUser || !notifyMessage.trim()) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: selectedUser.id,
        title: '관리자 알림',
        message: notifyMessage,
        read: false,
        createdAt: serverTimestamp()
      });
      setNotifyDialog(false);
      setNotifyMessage('');
      setSnackbar({ open: true, message: '알림 전송 완료', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '알림 전송 실패', severity: 'error' });
    }
  };

  const handleGivePoints = async () => {
    if (!selectedUser || !pointAmount) return;
    const amount = Number(pointAmount);
    if (isNaN(amount) || amount === 0) {
      setSnackbar({ open: true, message: '올바른 포인트를 입력하세요', severity: 'error' });
      return;
    }

    try {
      // 사용자 포인트 업데이트
      await updateDoc(doc(db, 'users', selectedUser.id), {
        points: increment(amount),
        updatedAt: serverTimestamp()
      });

      // 포인트 내역 기록
      await addDoc(collection(db, 'users', selectedUser.id, 'pointHistory'), {
        type: amount > 0 ? 'admin_give' : 'admin_deduct',
        amount: amount,
        description: pointReason || (amount > 0 ? '관리자 지급' : '관리자 차감'),
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      // 알림 전송
      await addDoc(collection(db, 'notifications'), {
        userId: selectedUser.id,
        title: amount > 0 ? '포인트 지급' : '포인트 차감',
        message: `${pointReason || '관리자'}: ${amount > 0 ? '+' : ''}${amount.toLocaleString()}P`,
        read: false,
        createdAt: serverTimestamp()
      });

      setPointDialog(false);
      setPointAmount('');
      setPointReason('');
      setSnackbar({ open: true, message: `${selectedUser.nickname}에게 ${amount > 0 ? '+' : ''}${amount.toLocaleString()}P ${amount > 0 ? '지급' : '차감'} 완료`, severity: 'success' });
      loadUsers();
    } catch (error) {
      setSnackbar({ open: true, message: '포인트 처리 실패: ' + error.message, severity: 'error' });
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('이 리뷰를 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      setUserReviews(prev => prev.filter(r => r.id !== reviewId));
      setSnackbar({ open: true, message: '리뷰 삭제 완료', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: '리뷰 삭제 실패', severity: 'error' });
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const filtered = users.filter(u => {
    const matchSearch =
      (u.nickname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.id || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchFilter =
      filterStatus === 'all' ? true :
      filterStatus === 'blocked' ? u.blocked === true :
      filterStatus === 'active' ? !u.blocked :
      filterStatus === 'hasPoints' ? (u.points || 0) > 0 :
      filterStatus === 'noPoints' ? (u.points || 0) === 0 :
      true;

    return matchSearch && matchFilter;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">사용자 관리</Typography>
        <Button startIcon={<Refresh />} onClick={loadUsers} variant="outlined">새로고침</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="이름, 이메일, ID로 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: '#999' }} /> }}
          sx={{ width: 400 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>필터</InputLabel>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="필터">
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="active">정상</MenuItem>
            <MenuItem value="blocked">차단됨</MenuItem>
            <MenuItem value="hasPoints">포인트 보유</MenuItem>
            <MenuItem value="noPoints">포인트 없음</MenuItem>
          </Select>
        </FormControl>
        <Chip label={`${filtered.length}명`} />
      </Box>

      <Card sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F5F6FA' }}>
                <TableCell><strong>이름</strong></TableCell>
                <TableCell><strong>이메일</strong></TableCell>
                <TableCell><strong>포인트</strong></TableCell>
                <TableCell><strong>방문 수</strong></TableCell>
                <TableCell><strong>리뷰 수</strong></TableCell>
                <TableCell><strong>가입일</strong></TableCell>
                <TableCell><strong>상태</strong></TableCell>
                <TableCell align="center"><strong>관리</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>사용자가 없습니다</TableCell></TableRow>
              ) : filtered.map((user) => (
                <TableRow key={user.id} hover sx={{ opacity: user.blocked ? 0.5 : 1 }}>
                  <TableCell sx={{ fontWeight: 600 }}>{user.nickname || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell sx={{ color: '#FF6B6B', fontWeight: 600 }}>{(user.points || 0).toLocaleString()}P</TableCell>
                  <TableCell>{user.totalVisits || 0}</TableCell>
                  <TableCell>{user.reviewCount || 0}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    {user.blocked ? (
                      <Chip label="차단됨" color="error" size="small" />
                    ) : (
                      <Chip label="정상" color="success" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="상세보기">
                      <IconButton size="small" onClick={() => loadUserDetail(user)}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="포인트 지급">
                      <IconButton size="small" color="warning" onClick={() => {
                        setSelectedUser(user);
                        setPointAmount('');
                        setPointReason('');
                        setPointDialog(true);
                      }}>
                        <CardGiftcard fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="알림 보내기">
                      <IconButton size="small" color="primary" onClick={() => {
                        setSelectedUser(user);
                        setNotifyMessage('');
                        setNotifyDialog(true);
                      }}>
                        <Notifications fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.blocked ? '차단 해제' : '차단'}>
                      <IconButton size="small" color={user.blocked ? 'success' : 'error'} onClick={() => handleBlockUser(user)}>
                        <Block fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 사용자 상세 */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>사용자 상세 — {selectedUser?.nickname || selectedUser?.id}</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <>
              <Grid container spacing={2} sx={{ mb: 2, mt: 0 }}>
                <Grid item xs={3}>
                  <Card sx={{ bgcolor: '#F5F6FA', textAlign: 'center', p: 2 }}>
                    <Person sx={{ color: '#4CAF50' }} />
                    <Typography variant="h6" fontWeight="bold">{selectedUser.nickname || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedUser.email || '-'}</Typography>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card sx={{ bgcolor: '#FFF5F5', textAlign: 'center', p: 2 }}>
                    <Typography variant="caption" color="text.secondary">포인트</Typography>
                    <Typography variant="h5" fontWeight="bold" color="#FF6B6B">
                      {(selectedUser.points || 0).toLocaleString()}P
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card sx={{ bgcolor: '#E8F5E9', textAlign: 'center', p: 2 }}>
                    <Typography variant="caption" color="text.secondary">방문</Typography>
                    <Typography variant="h5" fontWeight="bold" color="#4CAF50">
                      {selectedUser.totalVisits || 0}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card sx={{ bgcolor: '#E3F2FD', textAlign: 'center', p: 2 }}>
                    <Typography variant="caption" color="text.secondary">리뷰</Typography>
                    <Typography variant="h5" fontWeight="bold" color="#2196F3">
                      {selectedUser.reviewCount || userReviews.length}
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                가입일: {formatDate(selectedUser.createdAt)} | ID: {selectedUser.id}
              </Typography>

              <Tabs value={detailTab} onChange={(e, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                <Tab label={`방문 기록 (${userVisits.length})`} />
                <Tab label={`작성 리뷰 (${userReviews.length})`} />
              </Tabs>

              {detailTab === 0 && (
                userVisits.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>방문 기록이 없습니다</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>맛집</strong></TableCell>
                          <TableCell><strong>포인트</strong></TableCell>
                          <TableCell><strong>날짜</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {userVisits.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>{v.restaurantName || '-'}</TableCell>
                            <TableCell sx={{ color: '#FF6B6B' }}>+{(v.points || 0).toLocaleString()}P</TableCell>
                            <TableCell>{formatDate(v.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              )}

              {detailTab === 1 && (
                userReviews.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>작성한 리뷰가 없습니다</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>맛집</strong></TableCell>
                          <TableCell><strong>평점</strong></TableCell>
                          <TableCell><strong>내용</strong></TableCell>
                          <TableCell><strong>날짜</strong></TableCell>
                          <TableCell align="center"><strong>삭제</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {userReviews.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.restaurantName || '-'}</TableCell>
                            <TableCell><Rating value={r.rating || 0} size="small" readOnly /></TableCell>
                            <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.text || '-'}
                            </TableCell>
                            <TableCell>{formatDate(r.createdAt)}</TableCell>
                            <TableCell align="center">
                              <IconButton size="small" color="error" onClick={() => handleDeleteReview(r.id)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              )}
            </>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailDialog(false)}>닫기</Button></DialogActions>
      </Dialog>

      {/* 포인트 지급/차감 */}
      <Dialog open={pointDialog} onClose={() => setPointDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>포인트 지급/차감 — {selectedUser?.nickname}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            양수 입력 시 지급, 음수 입력 시 차감됩니다. 현재 포인트: {(selectedUser?.points || 0).toLocaleString()}P
          </Alert>
          <TextField
            fullWidth
            label="포인트 (예: 1000 또는 -500)"
            type="number"
            value={pointAmount}
            onChange={(e) => setPointAmount(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="사유 (선택)"
            value={pointReason}
            onChange={(e) => setPointReason(e.target.value)}
            placeholder="예: 이벤트 보상, 오류 보정 등"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPointDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleGivePoints} disabled={!pointAmount}
            sx={{ bgcolor: '#FF6B6B' }} startIcon={<CardGiftcard />}>
            {Number(pointAmount) >= 0 ? '지급' : '차감'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 알림 보내기 */}
      <Dialog open={notifyDialog} onClose={() => setNotifyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>알림 보내기 — {selectedUser?.nickname}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField
            fullWidth multiline rows={3}
            label="알림 메시지"
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder="사용자에게 보낼 메시지를 입력하세요"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNotifyDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleSendNotify} disabled={!notifyMessage.trim()}
            sx={{ bgcolor: '#FF6B6B' }} startIcon={<Notifications />}>전송</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
