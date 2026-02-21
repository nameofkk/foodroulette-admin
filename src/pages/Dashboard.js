import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField
} from '@mui/material';
import {
  People, Store, RateReview, CheckCircle,
  Campaign, Notifications, Today, PhoneAndroid
} from '@mui/icons-material';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';


export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0, totalSponsors: 0, totalReviews: 0, totalVisits: 0,
    todayVisits: 0, todayReviews: 0, pendingApplications: 0, todayAppOpens: 0
  });
  const [weeklyData, setWeeklyData] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(true);
  const [allVisits, setAllVisits] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [allAppOpens, setAllAppOpens] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDashboardData(); }, []);

  useEffect(() => {
    if (allVisits.length > 0 || allReviews.length > 0 || allAppOpens.length > 0) {
      buildWeeklyData(allVisits, allReviews, allAppOpens);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      let totalUsers = 0;
      try { const s = await getDocs(collection(db, 'users')); totalUsers = s.size; } catch (e) {}

      let totalSponsors = 0;
      try { const s = await getDocs(query(collection(db, 'ownerStores'), where('isSponsored', '==', true))); totalSponsors = s.size; } catch (e) {}

      let totalReviews = 0; let reviews = [];
      try {
        const s = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(1000)));
        totalReviews = s.size;
        reviews = s.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }));
      } catch (e) {}

      let totalVisits = 0; let visits = [];
      try {
        const s = await getDocs(query(collection(db, 'visits'), orderBy('createdAt', 'desc'), limit(1000)));
        totalVisits = s.size;
        visits = s.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }));
      } catch (e) {}

      let appOpens = [];
      try {
        const s = await getDocs(query(collection(db, 'appOpens'), orderBy('createdAt', 'desc'), limit(1000)));
        appOpens = s.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() }));
      } catch (e) {}

      const todayVisits = visits.filter(v => new Date(v.createdAt) >= today).length;
      const todayReviews = reviews.filter(r => new Date(r.createdAt) >= today).length;
      const todayAppOpens = appOpens.filter(a => new Date(a.createdAt) >= today).length;

      let pendingApplications = 0;
      try { const s = await getDocs(query(collection(db, 'sponsorApplications'), where('status', '==', 'pending'))); pendingApplications = s.size; } catch (e) {}

      setStats({ totalUsers, totalSponsors, totalReviews, totalVisits, todayVisits, todayReviews, pendingApplications, todayAppOpens });
      setAllVisits(visits);
      setAllReviews(reviews);
      setAllAppOpens(appOpens);
      buildWeeklyData(visits, reviews, appOpens);
    } catch (error) {
      console.error('대시보드 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildWeeklyData = (visits, reviews, appOpens) => {
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
        리뷰: reviews.filter(r => { const d = new Date(r.createdAt); return d >= date && d < nextDate; }).length,
        앱실행: appOpens.filter(a => { const d = new Date(a.createdAt); return d >= date && d < nextDate; }).length,
      });
    }
    setWeeklyData(data);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">대시보드</Typography>
        {stats.pendingApplications > 0 && (
          <Button variant="contained" color="warning" startIcon={<Notifications />}
            onClick={() => navigate('/sponsor-applications')}
            sx={{ animation: 'pulse 2s infinite' }}>
            신규 스폰서 신청 {stats.pendingApplications}건
          </Button>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, borderLeft: '4px solid #4CAF50' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">전체 사용자</Typography>
                  <Typography variant="h4" fontWeight="bold">{stats.totalUsers}</Typography>
                </Box>
                <People sx={{ fontSize: 40, color: '#4CAF50', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, borderLeft: '4px solid #FF9800' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">스폰서 가게</Typography>
                  <Typography variant="h4" fontWeight="bold">{stats.totalSponsors}</Typography>
                </Box>
                <Store sx={{ fontSize: 40, color: '#FF9800', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, borderLeft: '4px solid #2196F3' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">전체 리뷰</Typography>
                  <Typography variant="h4" fontWeight="bold">{stats.totalReviews}</Typography>
                </Box>
                <RateReview sx={{ fontSize: 40, color: '#2196F3', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, borderLeft: '4px solid #9C27B0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">전체 방문 인증</Typography>
                  <Typography variant="h4" fontWeight="bold">{stats.totalVisits}</Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 40, color: '#9C27B0', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, bgcolor: '#E8F5E9' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Today sx={{ color: '#4CAF50', fontSize: 28 }} />
              <Typography variant="h4" fontWeight="bold" color="#4CAF50">{stats.todayVisits}</Typography>
              <Typography variant="body2" color="text.secondary">오늘 방문 인증</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, bgcolor: '#E3F2FD' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <RateReview sx={{ color: '#2196F3', fontSize: 28 }} />
              <Typography variant="h4" fontWeight="bold" color="#2196F3">{stats.todayReviews}</Typography>
              <Typography variant="body2" color="text.secondary">오늘 리뷰 등록</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, bgcolor: '#F3E5F5' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <PhoneAndroid sx={{ color: '#9C27B0', fontSize: 28 }} />
              <Typography variant="h4" fontWeight="bold" color="#9C27B0">{stats.todayAppOpens}</Typography>
              <Typography variant="body2" color="text.secondary">오늘 앱 실행</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{ borderRadius: 3, bgcolor: stats.pendingApplications > 0 ? '#FFF3E0' : '#F5F5F5', cursor: stats.pendingApplications > 0 ? 'pointer' : 'default' }}
            onClick={() => stats.pendingApplications > 0 && navigate('/sponsor-applications')}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Campaign sx={{ color: stats.pendingApplications > 0 ? '#FF9800' : '#999', fontSize: 28 }} />
              <Typography variant="h4" fontWeight="bold" color={stats.pendingApplications > 0 ? '#FF9800' : '#999'}>
                {stats.pendingApplications}
              </Typography>
              <Typography variant="body2" color="text.secondary">신규 스폰서 신청</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ p: 3, borderRadius: 3 }}>
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
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="앱실행" fill="#9C27B0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="방문" fill="#4CAF50" radius={[4, 4, 0, 0]} />
            <Bar dataKey="리뷰" fill="#2196F3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </Box>
  );
}
