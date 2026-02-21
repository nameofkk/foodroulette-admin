import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Snackbar, Alert, Tabs, Tab,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, Reply as ReplyIcon } from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc,
  serverTimestamp, addDoc,
} from 'firebase/firestore';

export default function InquiryManage() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState('all'); // all | pending | answered
  const [searchTerm, setSearchTerm] = useState('');
  const [answerDialog, setAnswerDialog] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInquiries(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredInquiries = inquiries.filter((inq) => {
    if (tabValue === 'pending' && inq.status !== 'pending') return false;
    if (tabValue === 'answered' && inq.status !== 'answered') return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        (inq.title || '').toLowerCase().includes(s) ||
        (inq.userName || '').toLowerCase().includes(s) ||
        (inq.content || '').toLowerCase().includes(s) ||
        (inq.category || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const pendingCount = inquiries.filter((i) => i.status === 'pending').length;

  const openAnswer = (inq) => {
    setSelectedInquiry(inq);
    setAnswerText(inq.answer || '');
    setAnswerDialog(true);
  };

  const handleAnswer = async () => {
    if (!answerText.trim()) {
      setSnackbar({ open: true, message: '답변을 입력해주세요.', severity: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'inquiries', selectedInquiry.id), {
        answer: answerText.trim(),
        status: 'answered',
        answeredAt: serverTimestamp(),
      });

      // 사용자에게 알림 보내기
      await addDoc(collection(db, 'notifications'), {
        userId: selectedInquiry.userId,
        type: 'inquiry_answer',
        title: '문의 답변 도착',
        message: `"${selectedInquiry.title}" 문의에 답변이 등록되었습니다.`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setSnackbar({ open: true, message: '답변이 등록되고 사용자에게 알림이 발송되었습니다.', severity: 'success' });
      setAnswerDialog(false);
    } catch (e) {
      console.log('답변 에러:', e);
      setSnackbar({ open: true, message: '답변 등록에 실패했습니다.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        문의 관리
      </Typography>

      {/* 상단 카드 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography color="text.secondary" fontSize={13}>전체 문의</Typography>
            <Typography variant="h4" fontWeight={700}>{inquiries.length}</Typography>
          </CardContent>
        </Card>
        <Card
          sx={{ flex: 1, cursor: 'pointer', border: tabValue === 'pending' ? '2px solid #FF9800' : 'none' }}
          onClick={() => setTabValue('pending')}
        >
          <CardContent>
            <Typography color="text.secondary" fontSize={13}>대기 중</Typography>
            <Typography variant="h4" fontWeight={700} color="#FF9800">{pendingCount}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography color="text.secondary" fontSize={13}>답변 완료</Typography>
            <Typography variant="h4" fontWeight={700} color="#4CAF50">{inquiries.length - pendingCount}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 검색 + 탭 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="전체" value="all" />
          <Tab label={`대기 중 (${pendingCount})`} value="pending" />
          <Tab label="답변 완료" value="answered" />
        </Tabs>
        <TextField
          size="small"
          placeholder="검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 250 }}
        />
      </Box>

      {/* 테이블 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>상태</TableCell>
              <TableCell>카테고리</TableCell>
              <TableCell>제목</TableCell>
              <TableCell>작성자</TableCell>
              <TableCell>역할</TableCell>
              <TableCell>등록일</TableCell>
              <TableCell>관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInquiries.map((inq) => (
              <TableRow key={inq.id} hover>
                <TableCell>
                  <Chip
                    label={inq.status === 'answered' ? '답변 완료' : '대기 중'}
                    color={inq.status === 'answered' ? 'success' : 'warning'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{inq.category}</TableCell>
                <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inq.title}
                </TableCell>
                <TableCell>{inq.userName}</TableCell>
                <TableCell>
                  <Chip
                    label={inq.userRole === 'owner' ? '사장님' : '사용자'}
                    size="small"
                    variant="outlined"
                    color={inq.userRole === 'owner' ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: 13 }}>{formatDate(inq.createdAt)}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant={inq.status === 'answered' ? 'outlined' : 'contained'}
                    startIcon={<ReplyIcon />}
                    onClick={() => openAnswer(inq)}
                  >
                    {inq.status === 'answered' ? '수정' : '답변'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredInquiries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#999' }}>
                  문의가 없습니다
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 답변 다이얼로그 */}
      <Dialog open={answerDialog} onClose={() => setAnswerDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>문의 상세 / 답변</DialogTitle>
        <DialogContent>
          {selectedInquiry && (
            <Box>
              <Box sx={{ mb: 2, p: 2, bgcolor: '#F5F5F5', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Chip label={selectedInquiry.category} size="small" />
                  <Chip
                    label={selectedInquiry.userRole === 'owner' ? '사장님' : '사용자'}
                    size="small"
                    variant="outlined"
                  />
                  <Typography fontSize={12} color="text.secondary" sx={{ ml: 'auto' }}>
                    {formatDate(selectedInquiry.createdAt)}
                  </Typography>
                </Box>
                <Typography fontWeight={700} sx={{ mb: 1 }}>{selectedInquiry.title}</Typography>
                <Typography fontSize={14} color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedInquiry.content}
                </Typography>
                <Typography fontSize={12} color="text.secondary" sx={{ mt: 1 }}>
                  작성자: {selectedInquiry.userName} ({selectedInquiry.userEmail || '-'})
                </Typography>
              </Box>

              <Typography fontWeight={600} sx={{ mb: 1 }}>답변 작성</Typography>
              <TextField
                fullWidth
                multiline
                rows={5}
                placeholder="답변을 입력하세요..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnswerDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleAnswer} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : '답변 등록'}
          </Button>
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
