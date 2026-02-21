import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, Tabs, Tab, Divider
} from '@mui/material';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const [tab, setTab] = useState(0); // 0: 로그인, 1: 사장님 회원가입
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // ─── 로그인 ───
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // 이메일 인증 확인
      // admin 계정은 이메일 인증 면제 (Firestore에서 role 확인)
      const adminDoc = await getDoc(doc(db, 'adminUsers', userCredential.user.uid));
      const isAdmin = adminDoc.exists() && adminDoc.data().role === 'admin';

      if (!userCredential.user.emailVerified && !isAdmin) {

        try {
          await sendEmailVerification(userCredential.user);
        } catch (e) {
          // 너무 자주 보내면 에러 — 무시
        }
        await firebaseSignOut(auth);
        setError('이메일 인증이 필요합니다. 인증 메일을 다시 보냈으니 이메일을 확인해주세요.');
        setLoading(false);
        return;
      }
      // 인증 완료 → App.js의 onAuthStateChanged가 나머지 처리
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.code === 'auth/invalid-email') {
        setError('올바른 이메일 형식이 아닙니다.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError('로그인 실패: ' + err.message);
      }
    }
    setLoading(false);
  };

  // ─── 사장님 회원가입 ───
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 입력값 검증
    if (!ownerName.trim()) {
      setError('이름(상호명)을 입력해주세요.');
      return;
    }
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      // 1. Firebase Auth에 계정 생성
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Firestore adminUsers 문서 생성 (역할: owner)
      await setDoc(doc(db, 'adminUsers', user.uid), {
        email: user.email,
        role: 'owner',
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        emailVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. 인증 이메일 발송
      await sendEmailVerification(user);

      // 4. 인증 전에는 로그인 상태 유지하지 않음
      await firebaseSignOut(auth);

      setSuccess('인증 이메일을 보냈습니다! 이메일에서 인증 링크를 클릭한 후 로그인해주세요.');
      // 입력값 초기화
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setOwnerName('');
      setPhone('');
      setTab(0);



    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'auth/invalid-email') {
        setError('올바른 이메일 형식이 아닙니다.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다. 6자 이상 입력해주세요.');
      } else {
        setError('회원가입 실패: ' + err.message);
      }
    }
    setLoading(false);
  };

  // ─── 탭 전환 시 초기화 ───
  const handleTabChange = (e, newValue) => {
    setTab(newValue);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setOwnerName('');
    setPhone('');
  };

  return (
    <Box sx={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', bgcolor: '#1A1A2E'
    }}>
      <Card sx={{ width: 440, borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <CardContent sx={{ p: 4 }}>
          {/* 로고 영역 */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#FF6B6B' }}>
              🎰
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>
              FoodRoulette
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              사장님 전용 관리 패널
            </Typography>
          </Box>

          {/* 탭: 로그인 / 회원가입 */}
          <Tabs
            value={tab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              mb: 3,
              '& .MuiTab-root': { fontWeight: 600 },
              '& .Mui-selected': { color: '#FF6B6B' },
              '& .MuiTabs-indicator': { backgroundColor: '#FF6B6B' },
            }}
          >
            <Tab label="로그인" />
            <Tab label="사장님 회원가입" />
          </Tabs>

          {/* 에러/성공 메시지 */}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          {/* ─── 로그인 폼 ─── */}
          {tab === 0 && (
            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="이메일"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
                required
              />
              <TextField
                fullWidth
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 3 }}
                required
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5, borderRadius: 2,
                  bgcolor: '#FF6B6B', '&:hover': { bgcolor: '#FF4757' }
                }}
              >
                {loading ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          )}

          {/* ─── 회원가입 폼 ─── */}
          {tab === 1 && (
            <form onSubmit={handleRegister}>
              <TextField
                fullWidth
                label="이름 (사장님 이름 또는 상호명)"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                sx={{ mb: 2 }}
                required
                placeholder="예: 홍길동 / 맛있는 식당"
              />
              <TextField
                fullWidth
                label="연락처 (선택)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                sx={{ mb: 2 }}
                placeholder="예: 010-1234-5678"
              />

              <Divider sx={{ my: 2 }} />

              <TextField
                fullWidth
                label="이메일"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
                required
                placeholder="로그인에 사용할 이메일"
              />
              <TextField
                fullWidth
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 2 }}
                required
                helperText="6자 이상 입력해주세요"
              />
              <TextField
                fullWidth
                label="비밀번호 확인"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                sx={{ mb: 3 }}
                required
                error={passwordConfirm.length > 0 && password !== passwordConfirm}
                helperText={
                  passwordConfirm.length > 0 && password !== passwordConfirm
                    ? '비밀번호가 일치하지 않습니다'
                    : ''
                }
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5, borderRadius: 2,
                  bgcolor: '#FF6B6B', '&:hover': { bgcolor: '#FF4757' }
                }}
              >
                {loading ? '가입 중...' : '사장님 회원가입'}
              </Button>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'center', mt: 2 }}
              >
                가입 후 바로 내 가게를 등록하고 관리할 수 있습니다
              </Typography>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
