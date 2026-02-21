import { db, auth } from '../firebase';
import {
  collection, getDocs, addDoc, query, where, serverTimestamp
} from 'firebase/firestore';

const SEARCH_FUNCTION_URL = 'https://us-central1-foodroulette-1ca61.cloudfunctions.net/searchKakaoPlaces';

// ─── 카카오맵 장소 검색 ───
export async function searchKakaoPlaces(searchQuery) {
  if (!searchQuery.trim()) return [];

  const res = await fetch(
    `${SEARCH_FUNCTION_URL}?query=${encodeURIComponent(searchQuery)}`
  );
  const data = await res.json();
  return data.documents || [];
}

// ─── 가게 등록 (중복 체크 포함) ───
export async function registerStore(place) {
  const existQ = query(
    collection(db, 'ownerStores'),
    where('kakaoPlaceId', '==', place.id)
  );
  const existSnap = await getDocs(existQ);

  if (!existSnap.empty) {
    return { success: false, message: '이미 등록된 가게입니다' };
  }

  await addDoc(collection(db, 'ownerStores'), {
    name: place.place_name,
    address: place.road_address_name || place.address_name,
    category: place.category_name?.split('>').pop()?.trim() || '음식점',
    phone: place.phone || '',
    kakaoPlaceId: place.id,
    latitude: place.y,
    longitude: place.x,
    ownerEmail: auth.currentUser?.email || '',
    ownerId: auth.currentUser?.uid || '',
    isSponsored: false,
    sponsorStatus: 'none',
    bonusPointsBudget: 0,
    bonusPointsPerVisit: 0,
    bonusPointsActive: false,
    totalCharged: 0,
    totalFee: 0,
    totalBonusGiven: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { success: true, message: `${place.place_name} 등록 완료` };
}

// ─── 스폰서 상태 칩 정보 ───
export function getSponsorStatus(status) {
  const map = {
    none: { label: '미신청', color: 'default' },
    pending: { label: '심사중', color: 'warning' },
    approved: { label: '스폰서 활성', color: 'success' },
    rejected: { label: '거절됨', color: 'error' },
  };
  return map[status] || map.none;
}
