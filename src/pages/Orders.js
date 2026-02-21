import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Alert, Snackbar, Tooltip, Card, CardContent,
  Grid
} from '@mui/material';
import {
  CheckCircle, Cancel, LocalShipping, Refresh,
  Edit, Visibility, ShoppingCart, Pending, Done,
  ErrorOutline
} from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, getDocs, getDoc, doc, updateDoc, query,
  orderBy, serverTimestamp, where, increment, addDoc
} from 'firebase/firestore';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [note, setNote] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [stats, setStats] = useState({ pending: 0, processing: 0, completed: 0, cancelled: 0 });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      }));
      setOrders(items);

      const s = { pending: 0, processing: 0, completed: 0, cancelled: 0 };
      items.forEach((o) => {
        if (s[o.status] !== undefined) s[o.status]++;
      });
      setStats(s);
    } catch (error) {
      console.error('주문 로드 실패:', error);
      setSnackbar({ open: true, message: '주문 목록 로드 실패', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const order = orders.find((o) => o.id === orderId);

    // ★ 먼저 주문 상태 업데이트 (가장 중요한 동작)
    await updateDoc(doc(db, 'orders', orderId), {
      status: newStatus,
      note: note,
      updatedAt: serverTimestamp(),
    });

    // ★ 취소 시 포인트 환불
    if (newStatus === 'cancelled' && order && order.pointCost > 0 && order.userId) {
      try {
        const userRef = doc(db, 'users', order.userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          await updateDoc(userRef, {
            points: increment(order.pointCost),
            updatedAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'users', order.userId, 'pointHistory'), {
            type: 'refund',
            amount: order.pointCost,
            description: `주문 취소 환불 - ${order.productName}`,
            date: new Date().toISOString().split('T')[0],
            orderId: orderId,
            createdAt: serverTimestamp(),
          });

          // 재고 복구
          if (order.productId && !order.productId.startsWith('default_')) {
            try {
              const productRef = doc(db, 'products', order.productId);
              await updateDoc(productRef, {
                stock: increment(1),
              });
            } catch (stockError) {
              console.error('재고 복구 실패:', stockError);
            }
          }
        }
      } catch (refundError) {
        console.error('포인트 환불 실패:', refundError);
        setSnackbar({
          open: true,
          message: `주문은 취소되었으나 포인트 환불 실패. 수동 처리 필요 (${order.pointCost}P → ${order.userNickname})`,
          severity: 'warning',
        });
        fetchOrders();
        setDialogOpen(false);
        setNote('');
        return;
      }
    }

    // ★ 취소→대기 복원 시 포인트 재차감
    if (newStatus === 'pending' && order && order.status === 'cancelled' && order.pointCost > 0 && order.userId) {
      try {
        const userRef = doc(db, 'users', order.userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const currentPoints = userSnap.data().points || 0;
          if (currentPoints >= order.pointCost) {
            await updateDoc(userRef, {
              points: increment(-order.pointCost),
              updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'users', order.userId, 'pointHistory'), {
              type: 'use',
              amount: -order.pointCost,
              description: `주문 복원 재차감 - ${order.productName}`,
              date: new Date().toISOString().split('T')[0],
              orderId: orderId,
              createdAt: serverTimestamp(),
            });
          } else {
            setSnackbar({
              open: true,
              message: `포인트 부족으로 재차감 불가 (잔액: ${currentPoints}P, 필요: ${order.pointCost}P)`,
              severity: 'warning',
            });
          }
        }
      } catch (deductError) {
        console.error('포인트 재차감 실패:', deductError);
      }
    }

    setSnackbar({
      open: true,
      message: newStatus === 'cancelled'
        ? `주문 취소 완료 (${order?.pointCost?.toLocaleString() || 0}P 환불됨)`
        : `주문 상태: ${getStatusLabel(newStatus)}`,
      severity: 'success',
    });
    setDialogOpen(false);
    setNote('');
    fetchOrders();
  } catch (error) {
    console.error('상태 업데이트 실패:', error);
    setSnackbar({ open: true, message: '업데이트 실패: ' + error.message, severity: 'error' });
  }
};

  const getStatusLabel = (status) => {
    const map = {
      pending: '대기중',
      processing: '처리중',
      completed: '완료',
      cancelled: '취소',
    };
    return map[status] || status;
  };

  const getStatusColor = (status) => {
    const map = {
      pending: 'warning',
      processing: 'info',
      completed: 'success',
      cancelled: 'error',
    };
    return map[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const map = {
      pending: <Pending />,
      processing: <LocalShipping />,
      completed: <Done />,
      cancelled: <ErrorOutline />,
    };
    return map[status] || <Pending />;
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter((o) => o.status === filterStatus);

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          주문 관리
        </Typography>
        <Button startIcon={<Refresh />} onClick={fetchOrders} variant="outlined">
          새로고침
        </Button>
      </Box>

      {/* 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <Card sx={{ bgcolor: '#FFF3E0' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Pending sx={{ color: '#FF9800', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold" color="#FF9800">{stats.pending}</Typography>
              <Typography variant="body2" color="text.secondary">대기중</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card sx={{ bgcolor: '#E3F2FD' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <LocalShipping sx={{ color: '#2196F3', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold" color="#2196F3">{stats.processing}</Typography>
              <Typography variant="body2" color="text.secondary">처리중</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card sx={{ bgcolor: '#E8F5E9' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Done sx={{ color: '#4CAF50', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold" color="#4CAF50">{stats.completed}</Typography>
              <Typography variant="body2" color="text.secondary">완료</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card sx={{ bgcolor: '#FFEBEE' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <ErrorOutline sx={{ color: '#F44336', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold" color="#F44336">{stats.cancelled}</Typography>
              <Typography variant="body2" color="text.secondary">취소</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 필터 */}
      <Box sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>상태 필터</InputLabel>
          <Select
            value={filterStatus}
            label="상태 필터"
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <MenuItem value="all">전체 ({orders.length})</MenuItem>
            <MenuItem value="pending">대기중 ({stats.pending})</MenuItem>
            <MenuItem value="processing">처리중 ({stats.processing})</MenuItem>
            <MenuItem value="completed">완료 ({stats.completed})</MenuItem>
            <MenuItem value="cancelled">취소 ({stats.cancelled})</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* 주문 테이블 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F5F5F5' }}>
              <TableCell><strong>주문일시</strong></TableCell>
              <TableCell><strong>사용자</strong></TableCell>
              <TableCell><strong>상품</strong></TableCell>
              <TableCell align="right"><strong>포인트</strong></TableCell>
              <TableCell align="center"><strong>상태</strong></TableCell>
              <TableCell><strong>메모</strong></TableCell>
              <TableCell align="center"><strong>관리</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  로딩 중...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  주문이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {order.userNickname}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.userEmail}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{order.productName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.productCategory}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold" color="#FF6B6B">
                      {order.pointCost?.toLocaleString()}P
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      icon={getStatusIcon(order.status)}
                      label={getStatusLabel(order.status)}
                      color={getStatusColor(order.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {order.note || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="상태 변경">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedOrder(order);
                          setNote(order.note || '');
                          setDialogOpen(true);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 상태 변경 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>주문 상태 변경</DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom>
                <strong>사용자:</strong> {selectedOrder.userNickname}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>상품:</strong> {selectedOrder.productName}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>포인트:</strong> {selectedOrder.pointCost?.toLocaleString()}P
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>현재 상태:</strong> {getStatusLabel(selectedOrder.status)}
              </Typography>
              <TextField
                fullWidth
                label="메모 (선택)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                multiline
                rows={2}
                sx={{ mt: 2, mb: 2 }}
                placeholder="쿠폰 발송 완료, 재고 부족 등"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            닫기
          </Button>
          {selectedOrder?.status === 'pending' && (
            <>
              <Button
                variant="contained"
                color="info"
                startIcon={<LocalShipping />}
                onClick={() => updateOrderStatus(selectedOrder.id, 'processing')}
              >
                처리중
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<Cancel />}
                onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
              >
                취소
              </Button>
            </>
          )}
          {selectedOrder?.status === 'processing' && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
              >
                완료
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<Cancel />}
                onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
              >
                취소
              </Button>
            </>
          )}
          {(selectedOrder?.status === 'completed' || selectedOrder?.status === 'cancelled') && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<Pending />}
              onClick={() => updateOrderStatus(selectedOrder.id, 'pending')}
            >
              대기로 되돌리기
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
