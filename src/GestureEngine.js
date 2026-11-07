/**
 * @file GestureEngine.js
 * @description Module nhận diện cử chỉ vẽ tay (Unistroke Gesture Recognition) thuần ES6 cho HTML5 Canvas.
 * Sử dụng giải thuật tối ưu kết hợp giữa Dollar Recognizer ($1) và Heuristic Geometric Validation.
 * 
 * Các cử chỉ hỗ trợ:
 * - 'horizontal' : Nét ngang (Trái -> Phải hoặc Phải -> Trái)
 * - 'vertical'   : Nét dọc (Trên -> Dưới hoặc Dưới -> Trên)
 * - 'v_shape'    : Chữ V (Đi xuống rồi đi lên)
 * - 'caret'      : Đỉnh núi / Chữ V ngược ∧ (Đi lên rồi đi xuống)
 * - 'lightning'  : Tia sét ziczac (⚡)
 * - 'heart'      : Trái tim đơn giản hóa (❤️)
 */

import { RUNES } from './core/Constants.js';

/**
 * Tính khoảng cách Euclidean giữa 2 điểm
 * @param {{x: number, y: number}} p1 
 * @param {{x: number, y: number}} p2 
 * @returns {number}
 */
export function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Tính tổng chiều dài đường đi của một polyline
 * @param {Array<{x: number, y: number}>} points 
 * @returns {number}
 */
export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distance(points[i - 1], points[i]);
  }
  return len;
}

/**
 * BƯỚC 1: RESAMPLING (Lấy mẫu lại nét vẽ)
 * Chuẩn hóa một nét vẽ bất kỳ về đúng N điểm cách đều nhau theo chiều dài đường cong.
 * 
 * @param {Array<{x: number, y: number}>} points 
 * @param {number} n Số lượng điểm cần lấy mẫu (mặc định 32)
 * @returns {Array<{x: number, y: number}>}
 */
export function resample(points, n = 32) {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return Array(n).fill({ x: points[0].x, y: points[0].y });

  const totalLen = pathLength(points);
  if (totalLen === 0) return Array(n).fill({ x: points[0].x, y: points[0].y });

  const interval = totalLen / (n - 1);
  const resampled = [{ x: points[0].x, y: points[0].y }];
  let accumulatedDist = 0;

  // Clone mảng điểm để không làm biến dạng dữ liệu gốc của caller
  const pts = points.map(p => ({ x: p.x, y: p.y }));

  for (let i = 1; i < pts.length; i++) {
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const d = distance(p1, p2);

    if (d === 0) continue;

    if (accumulatedDist + d >= interval) {
      const t = (interval - accumulatedDist) / d;
      const q = {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
      };
      resampled.push(q);
      pts[i - 1] = q; // Dịch điểm bắt đầu của đoạn hiện tại thành q
      accumulatedDist = 0;
      i--; // Tiếp tục xét phần còn lại của đoạn thẳng vừa cắt
    } else {
      accumulatedDist += d;
    }
  }

  // Bù đắp sai số số thực để luôn đảm bảo đúng n điểm
  while (resampled.length < n) {
    resampled.push({ ...pts[pts.length - 1] });
  }
  if (resampled.length > n) {
    resampled.length = n;
  }

  return resampled;
}

/**
 * BƯỚC 2: TÍNH TOÁN BOUNDING BOX
 * @param {Array<{x: number, y: number}>} points 
 * @returns {{minX: number, maxX: number, minY: number, maxY: number, width: number, height: number}}
 */
export function getBoundingBox(points) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX, maxX, minY, maxY,
    width: Math.max(1e-5, maxX - minX),
    height: Math.max(1e-5, maxY - minY)
  };
}

/**
 * BƯỚC 3: BOUNDING BOX NORMALIZATION (Chuẩn hóa kích thước về khung 100x100)
 * 
 * LƯU Ý KỸ THUẬT QUAN TRỌNG TỪ THUẬT TOÁN $1:
 * Với cử chỉ 1D (nét thẳng ngang hoặc dọc), nếu scale phi tỉ lệ (non-uniform) sẽ kéo dãn
 * độ rung tay nhỏ (vài pixel) thành hình vuông hoặc đường chéo méo mó.
 * Do đó, nếu min(w, h) / max(w, h) < oneDThreshold, ta scale đồng dạng theo cạnh lớn nhất
 * và căn giữa nét vẽ trong khung 100x100.
 * Với cử chỉ 2D (V, caret, heart, lightning), scale lấp đầy khung 100x100.
 * 
 * @param {Array<{x: number, y: number}>} points 
 * @param {number} size Kích thước hộp chuẩn hóa (mặc định 100)
 * @param {number} oneDThreshold Ngưỡng phân định nét thẳng 1D (mặc định 0.25)
 * @returns {Array<{x: number, y: number}>}
 */
export function normalizeBoundingBox(points, size = 100, oneDThreshold = 0.25) {
  const box = getBoundingBox(points);
  const w = box.width;
  const h = box.height;
  const is1D = Math.min(w, h) / Math.max(w, h) < oneDThreshold;

  if (is1D) {
    const scale = w > h ? size / w : size / h;
    const offsetX = (size - w * scale) / 2;
    const offsetY = (size - h * scale) / 2;
    return points.map(p => ({
      x: (p.x - box.minX) * scale + offsetX,
      y: (p.y - box.minY) * scale + offsetY
    }));
  } else {
    return points.map(p => ({
      x: ((p.x - box.minX) / w) * size,
      y: ((p.y - box.minY) / h) * size
    }));
  }
}

/**
 * Tính khoảng cách trung bình giữa 2 mảng điểm cùng kích thước
 * @param {Array<{x: number, y: number}>} pts1 
 * @param {Array<{x: number, y: number}>} pts2 
 * @returns {number}
 */
export function pathDistance(pts1, pts2) {
  let d = 0;
  for (let i = 0; i < pts1.length; i++) {
    d += distance(pts1[i], pts2[i]);
  }
  return d / pts1.length;
}

/**
 * Tạo tập mẫu thô cho hình tròn ở mọi góc bắt đầu (12 góc quanh đồng hồ) và 2 chiều vẽ (CW, CCW)
 * kèm theo các nét vòng tròn vẽ nhanh khép góc 80%-85%.
 * @returns {Array<Array<{x: number, y: number}>>}
 */
function generateCircleRawTemplates() {
  const list = [];
  // 12 góc quanh đồng hồ (mỗi góc 30 độ), thuận và ngược chiều kim đồng hồ
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180;
    for (const cw of [true, false]) {
      const stroke = [];
      const steps = 24;
      for (let s = 0; s <= steps; s++) {
        const a = rad + (cw ? 1 : -1) * (s / steps) * Math.PI * 2;
        stroke.push({
          x: Number((50 + 44 * Math.cos(a)).toFixed(1)),
          y: Number((50 + 44 * Math.sin(a)).toFixed(1))
        });
      }
      list.push(stroke);
    }
  }
  // Thêm các vòng khép 80%-85% (người chơi vẽ nhanh không kịp khép kín 100%)
  for (let deg = 0; deg < 360; deg += 90) {
    const rad = (deg * Math.PI) / 180;
    for (const cw of [true, false]) {
      const stroke = [];
      const steps = 20;
      for (let s = 0; s <= steps; s++) {
        const a = rad + (cw ? 1 : -1) * (s / steps) * Math.PI * 1.65;
        stroke.push({
          x: Number((50 + 44 * Math.cos(a)).toFixed(1)),
          y: Number((50 + 44 * Math.sin(a)).toFixed(1))
        });
      }
      list.push(stroke);
    }
  }
  return list;
}

/**
 * Tạo tập mẫu thô cho nét xoắn ốc (hỗ trợ cả cuộn từ ngoài vào trong và xoắn từ trong tâm ra ngoài)
 * @returns {Array<Array<{x: number, y: number}>>}
 */
function generateSpiralRawTemplates() {
  const list = [];
  const startAngles = [0, 90, 180, 270];
  const turnOptions = [1.25, 1.55, 1.85];

  for (const deg of startAngles) {
    const startRad = (deg * Math.PI) / 180;
    for (const turns of turnOptions) {
      for (const cw of [true, false]) {
        // 1. Cuộn từ ngoài vào trong tâm (Outside -> In)
        const rawIn = [];
        const steps = 30;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const a = startRad + (cw ? 1 : -1) * t * turns * Math.PI * 2;
          const r = (1 - 0.72 * t) * 44;
          rawIn.push({
            x: Number((50 + r * Math.cos(a)).toFixed(1)),
            y: Number((50 + r * Math.sin(a)).toFixed(1))
          });
        }
        list.push(rawIn);

        // 2. Xoắn từ trong tâm ra ngoài (Inside -> Out)
        const rawOut = [];
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const a = startRad + (cw ? 1 : -1) * t * turns * Math.PI * 2;
          const r = (0.12 + 0.88 * t) * 44;
          rawOut.push({
            x: Number((50 + r * Math.cos(a)).toFixed(1)),
            y: Number((50 + r * Math.sin(a)).toFixed(1))
          });
        }
        list.push(rawOut);
      }
    }
  }

  // Nét xoáy bão / cuộn gió casual
  list.push([
    { x: 20, y: 10 }, { x: 80, y: 15 }, { x: 90, y: 50 }, { x: 60, y: 85 },
    { x: 25, y: 75 }, { x: 30, y: 40 }, { x: 65, y: 45 }, { x: 55, y: 60 }
  ]);
  list.push([
    { x: 80, y: 10 }, { x: 20, y: 15 }, { x: 10, y: 50 }, { x: 40, y: 85 },
    { x: 75, y: 75 }, { x: 70, y: 40 }, { x: 35, y: 45 }, { x: 45, y: 60 }
  ]);
  return list;
}

/**
 * DANH SÁCH KHUNG MẪU GỐC (RAW TEMPLATES) TRONG HỆ TOẠ ĐỘ 100x100
 * Bao gồm các biến thể chiều vẽ (thuận, nghịch, clockwise, counter-clockwise)
 * đảm bảo người dùng vẽ chiều nào cũng được nhận diện chính xác.
 */
const DEFAULT_RAW_TEMPLATES = {
  horizontal: [
    // Trái sang Phải
    [{ x: 0, y: 50 }, { x: 100, y: 50 }],
    // Phải sang Trái
    [{ x: 100, y: 50 }, { x: 0, y: 50 }]
  ],
  vertical: [
    // Trên xuống Dưới
    [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    // Dưới lên Trên
    [{ x: 50, y: 100 }, { x: 50, y: 0 }]
  ],
  v_shape: [
    // Xuống rồi Lên (Trái -> Đáy -> Phải)
    [{ x: 5, y: 5 }, { x: 50, y: 95 }, { x: 95, y: 5 }],
    // Phải -> Đáy -> Trái
    [{ x: 95, y: 5 }, { x: 50, y: 95 }, { x: 5, y: 5 }]
  ],
  caret: [
    // Lên rồi Xuống (Trái -> Đỉnh -> Phải)
    [{ x: 5, y: 95 }, { x: 50, y: 5 }, { x: 95, y: 95 }],
    // Phải -> Đỉnh -> Trái
    [{ x: 95, y: 95 }, { x: 50, y: 5 }, { x: 5, y: 95 }]
  ],
  lightning: [
    // 1. Zic-zac dạng tia sét cổ điển (Z-shape: Trái -> Phải -> Chéo trái -> Phải)
    [{ x: 10, y: 15 }, { x: 90, y: 15 }, { x: 10, y: 85 }, { x: 90, y: 85 }],
    // 2. Chữ Z tự nhiên có độ nghiêng nhẹ
    [{ x: 20, y: 10 }, { x: 80, y: 18 }, { x: 25, y: 78 }, { x: 85, y: 90 }],
    // 3. Chữ Z đảo hướng (Phải -> Trái -> Chéo phải -> Trái)
    [{ x: 90, y: 15 }, { x: 10, y: 15 }, { x: 90, y: 85 }, { x: 10, y: 85 }],
    // 4. Chữ Z vẽ ngược từ dưới lên
    [{ x: 10, y: 85 }, { x: 90, y: 85 }, { x: 10, y: 15 }, { x: 90, y: 15 }],
    // 5. Tia sét thẳng đứng kinh điển 3 đoạn (Harry Potter / Google Doodle)
    [{ x: 55, y: 5 }, { x: 25, y: 45 }, { x: 75, y: 45 }, { x: 45, y: 95 }],
    [{ x: 45, y: 5 }, { x: 75, y: 45 }, { x: 25, y: 45 }, { x: 55, y: 95 }],
    // 6. Tia sét thẳng đứng vẽ từ dưới lên
    [{ x: 45, y: 95 }, { x: 75, y: 45 }, { x: 25, y: 45 }, { x: 55, y: 5 }],
    // 7. Tia sét góc nhọn từ trên chéo xuống
    [{ x: 30, y: 0 }, { x: 80, y: 35 }, { x: 20, y: 55 }, { x: 75, y: 100 }],
    [{ x: 70, y: 0 }, { x: 20, y: 35 }, { x: 80, y: 55 }, { x: 25, y: 100 }],
    // 8. Tia sét zic-zac 2 đoạn gập nhọn
    [{ x: 20, y: 15 }, { x: 80, y: 50 }, { x: 20, y: 85 }],
    [{ x: 80, y: 15 }, { x: 20, y: 50 }, { x: 80, y: 85 }],
    // 9. Nét vẩy sét nhanh trong thực chiến
    [{ x: 75, y: 10 }, { x: 35, y: 45 }, { x: 65, y: 45 }, { x: 25, y: 90 }],
    [{ x: 25, y: 10 }, { x: 65, y: 45 }, { x: 35, y: 45 }, { x: 75, y: 90 }]
  ],
  heart: [
    // Mẫu 1: Bắt đầu từ rãnh trên (top cleft), vẽ cánh trái trước -> chóp nhọn -> cánh phải -> về rãnh
    [
      { x: 50, y: 25 },
      { x: 35, y: 10 }, { x: 15, y: 5 }, { x: 0, y: 25 }, { x: 5, y: 55 },
      { x: 25, y: 80 }, { x: 50, y: 100 },
      { x: 75, y: 80 }, { x: 95, y: 55 }, { x: 100, y: 25 }, { x: 85, y: 5 }, { x: 65, y: 10 },
      { x: 50, y: 25 }
    ],
    // Mẫu 2: Bắt đầu từ rãnh trên, vẽ cánh phải trước
    [
      { x: 50, y: 25 },
      { x: 65, y: 10 }, { x: 85, y: 5 }, { x: 100, y: 25 }, { x: 95, y: 55 },
      { x: 75, y: 80 }, { x: 50, y: 100 },
      { x: 25, y: 80 }, { x: 5, y: 55 }, { x: 0, y: 25 }, { x: 15, y: 5 }, { x: 35, y: 10 },
      { x: 50, y: 25 }
    ],
    // Mẫu 3: Bắt đầu từ chóp nhọn đáy (50, 100) vòng lên cánh trái
    [
      { x: 50, y: 100 },
      { x: 25, y: 80 }, { x: 5, y: 55 }, { x: 0, y: 25 }, { x: 15, y: 5 }, { x: 35, y: 10 },
      { x: 50, y: 25 },
      { x: 65, y: 10 }, { x: 85, y: 5 }, { x: 100, y: 25 }, { x: 95, y: 55 }, { x: 75, y: 80 },
      { x: 50, y: 100 }
    ],
    // Mẫu 4: Vẽ trái tim dạng 2 vòng uốn đơn giản (casual heart)
    [
      { x: 10, y: 40 }, { x: 15, y: 15 }, { x: 35, y: 5 }, { x: 50, y: 25 },
      { x: 65, y: 5 }, { x: 85, y: 15 }, { x: 90, y: 40 }, { x: 50, y: 95 }
    ]
  ],
  circle: generateCircleRawTemplates(),
  spiral: generateSpiralRawTemplates()
};

/**
 * Class GestureEngine
 * Động cơ nhận diện cử chỉ 2D thời gian thực.
 */
export class GestureEngine {
  /**
   * Khởi tạo GestureEngine
   * @param {Object} [options={}]
   * @param {number} [options.minScore=0.70] Điểm khớp tối thiểu để chấp nhận cử chỉ (0..1)
   * @param {number} [options.minPathLength=15] Độ dài nét vẽ tối thiểu (chống click vô tình < 15px)
   * @param {number} [options.pointCount=32] Số điểm resampling
   * @param {number} [options.boxSize=100] Kích thước hộp chuẩn hóa
   */
  constructor(options = {}) {
    this.minScore = options.minScore ?? 0.65;
    this.thresholds = { caret: 0.78, v_shape: 0.78, circle: 0.78, ...options.thresholds };
    this.minMargin = options.minMargin ?? 0.025;
    this.maxInputPoints = options.maxInputPoints ?? 8192;
    this.oneDThreshold = options.oneDThreshold ?? 0.25;
    if (!Number.isInteger(options.pointCount ?? 32) || (options.pointCount ?? 32) < 8 || (options.pointCount ?? 32) > 256 ||
        !Number.isFinite(options.boxSize ?? 100) || (options.boxSize ?? 100) <= 0) {
      throw new RangeError('pointCount must be an integer from 8 to 256 and boxSize must be positive');
    }
    this.minPathLength = options.minPathLength ?? 15;
    this.pointCount = options.pointCount ?? 32;
    this.boxSize = options.boxSize ?? 100;

    /** @type {Array<{name: string, points: Array<{x: number, y: number}>}>} */
    this.templates = [];

    // Biên dịch sẵn toàn bộ template về 32 điểm chuẩn hóa 100x100
    this._compileTemplates(DEFAULT_RAW_TEMPLATES);
    // Inward/outward spirals are not exact time reversals; compile both explicitly.
    for (const stroke of DEFAULT_RAW_TEMPLATES.spiral) this.addTemplate('spiral', [...stroke].reverse());
  }

  /**
   * Biên dịch tập template thô thành tập điểm 32 resampled & normalized
   * @private
   */
  _compileTemplates(rawTemplatesMap) {
    this.templates = [];
    for (const [name, strokeList] of Object.entries(rawTemplatesMap)) {
      for (const rawStroke of strokeList) {
        const resampled = resample(rawStroke, this.pointCount);
        const normalized = normalizeBoundingBox(resampled, this.boxSize, this.oneDThreshold);
        this.templates.push({
          name,
          points: normalized
        });
      }
    }
  }

  /**
   * Thêm cử chỉ mẫu tự định nghĩa (Custom Template)
   * @param {string} name Tên cử chỉ
   * @param {Array<{x: number, y: number}>} points Mảng tọa độ mẫu
   */
  addTemplate(name, points) {
    if (!points || points.length < 2) return;
    const resampled = resample(points, this.pointCount);
    const normalized = normalizeBoundingBox(resampled, this.boxSize, this.oneDThreshold);
    this.templates.push({ name, points: normalized });
  }

  /**
   * Kiểm định hình học (Heuristic Geometric Gate)
   * Ngăn chặn các nét vẽ chéo hoặc nguệch ngoạc vô tình khớp điểm cao với các nét cơ bản.
   *
   * @private
   * @param {string} gesture Tên cử chỉ ứng viên
   * @param {{width: number, height: number}} rawBox Hộp bounding box nét gốc
   * @param {Array<{x: number, y: number}>} normalizedPoints Điểm đã chuẩn hóa
   * @returns {boolean}
   */
  _validateGeometry(gesture, rawBox, normalizedPoints) {
    return this._checkGeometry(gesture, rawBox, normalizedPoints) === null;
  }

  /**
   * Như _validateGeometry nhưng trả về MÃ LÝ DO khi nét vẽ không đạt (null nếu hợp lệ).
   * Mã lý do được dùng để gợi ý người chơi cách sửa nét vẽ (xem getMissHint).
   *
   * @private
   * @param {string} gesture
   * @param {{width: number, height: number}} rawBox
   * @param {Array<{x: number, y: number}>} normalizedPoints
   * @returns {string|null} 'tilted' | 'short' | 'off_center' | 'shallow' | 'no_zigzag' | 'bad_ratio' | 'open' | null
   */
  _checkGeometry(gesture, rawBox, normalizedPoints) {
    // Geometry thresholds use a canonical 100-unit space, independent of boxSize.
    normalizedPoints = normalizedPoints.map(p => ({x: p.x * 100 / this.boxSize, y: p.y * 100 / this.boxSize}));
    const { width, height } = rawBox;
    const aspect = width / Math.max(1e-5, height);

    switch (gesture) {
      case 'horizontal': {
        // Nét ngang bắt buộc width phải vượt trội so với height
        if (aspect < 1.7) return 'tilted';
        // Điểm đầu và điểm cuối phải quét ngang rõ rệt
        const dx = Math.abs(normalizedPoints[normalizedPoints.length - 1].x - normalizedPoints[0].x);
        return dx >= 65 ? null : 'short';
      }

      case 'vertical': {
        // Nét dọc bắt buộc height phải vượt trội so với width
        if (aspect > 1 / 1.7) return 'tilted';
        // Điểm đầu và điểm cuối phải quét dọc rõ rệt
        const dy = Math.abs(normalizedPoints[normalizedPoints.length - 1].y - normalizedPoints[0].y);
        return dy >= 65 ? null : 'short';
      }

      case 'v_shape': {
        // Chữ V: Đi xuống rồi đi lên
        const startY = normalizedPoints[0].y;
        const endY = normalizedPoints[normalizedPoints.length - 1].y;
        // Đáy chữ V (cực đại y) phải nằm ở sâu bên dưới
        let maxY = -Infinity;
        let maxIndex = 0;
        for (let i = 0; i < normalizedPoints.length; i++) {
          if (normalizedPoints[i].y > maxY) {
            maxY = normalizedPoints[i].y;
            maxIndex = i;
          }
        }
        // Đáy phải ở khoảng giữa [20% .. 80%] và sâu hơn điểm đầu/cuối ít nhất 35px
        if (maxIndex < normalizedPoints.length * 0.18 || maxIndex > normalizedPoints.length * 0.84) return 'off_center';
        return (maxY - startY >= 35) && (maxY - endY >= 35) ? null : 'shallow';
      }

      case 'caret': {
        // Chữ V ngược: Đi lên rồi đi xuống
        const startY = normalizedPoints[0].y;
        const endY = normalizedPoints[normalizedPoints.length - 1].y;
        // Đỉnh (cực tiểu y) phải nằm ở tít trên cao
        let minY = Infinity;
        let minIndex = 0;
        for (let i = 0; i < normalizedPoints.length; i++) {
          if (normalizedPoints[i].y < minY) {
            minIndex = i;
            minY = normalizedPoints[i].y;
          }
        }
        // Đỉnh phải ở khoảng giữa [20% .. 80%] và cao hơn điểm đầu/cuối ít nhất 35px
        if (minIndex < normalizedPoints.length * 0.18 || minIndex > normalizedPoints.length * 0.84) return 'off_center';
        return (startY - minY >= 35) && (endY - minY >= 35) ? null : 'shallow';
      }

      case 'lightning': {
        // Tia sét: Nét vẽ ziczac phải có ít nhất 1 lần gập góc / đảo chiều trên trục X hoặc Y
        // (Ví dụ Z-shape: Trái -> Phải -> Chéo trái -> Phải: 2 lần đảo chiều X)
        // (Hoặc tia sét thẳng đứng: Đi xuống -> Chéo lên/ngang -> Đi xuống: đảo chiều X hoặc Y)
        let dirX = 0, xReversals = 0;
        let dirY = 0, yReversals = 0;
        for (let i = 1; i < normalizedPoints.length; i++) {
          const dx = normalizedPoints[i].x - normalizedPoints[i - 1].x;
          const dy = normalizedPoints[i].y - normalizedPoints[i - 1].y;
          if (Math.abs(dx) > 1.2) {
            const sx = Math.sign(dx);
            if (dirX !== 0 && sx !== dirX) xReversals++;
            dirX = sx;
          }
          if (Math.abs(dy) > 1.2) {
            const sy = Math.sign(dy);
            if (dirY !== 0 && sy !== dirY) yReversals++;
            dirY = sy;
          }
        }
        return (xReversals >= 1 || yReversals >= 1) ? null : 'no_zigzag';
      }

      case 'heart': {
        // Trái tim: Chiều cao và chiều rộng tương đương, không thể là nét dẹt 1D
        if (aspect < 0.35 || aspect > 2.8) return 'bad_ratio';
        return null;
      }

      case 'circle': {
        // Vòng tròn (Frost Nova): Tỷ lệ khung tương đối vuông vức (không phải nét 1D)
        if (aspect < 0.35 || aspect > 2.8) return 'bad_ratio';
        // Điểm đầu và cuối tương đối gần nhau (< 72px trong ô 100x100 cho phép vẽ nhanh 75%-85% vòng)
        const closeDist = distance(normalizedPoints[0], normalizedPoints[normalizedPoints.length - 1]);
        if (closeDist > 72) return 'open';
        // Chiều dài đường bao quanh đủ lớn để tạo thành đường cong khép góc
        const totalCurve = pathLength(normalizedPoints);
        return totalCurve >= 115 ? null : 'short';
      }

      case 'spiral': {
        // Xoắn ốc / Cơn lốc cuộn gió (Gale Shockwave):
        // Nét vẽ 2D dạng cuộn xoáy dài (hỗ trợ cả vẽ cuộn vào trong lẫn xoắn từ tâm ra ngoài)
        if (aspect < 0.35 || aspect > 2.8) return 'bad_ratio';
        const totalCurve = pathLength(normalizedPoints);
        return totalCurve >= 115 ? null : 'short';
      }

      default:
        return null;
    }
  }

  /**
   * Phân tích một nét vẽ: resample, chuẩn hóa và chấm điểm với toàn bộ template.
   * Dùng chung cho recognize() và scoreFor().
   *
   * @private
   * @param {Array<{x: number, y: number}>} rawPoints
   * @returns {{status: 'no_input'|'too_short'|'ok', rawBox?: object, normalized?: Array, bestGesture?: string|null, bestScore?: number, perGesture?: Object<string, number>}}
   */
  _analyze(rawPoints) {
    // 1. Kiểm tra đầu vào hợp lệ
    if (!rawPoints || !Array.isArray(rawPoints) || rawPoints.length < 2) {
      return { status: 'no_input' };
    }

    if (rawPoints.length > this.maxInputPoints) return { status: 'too_complex' };
    if (rawPoints.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      return { status: 'invalid_input' };
    }

    // 2. Chống nhiễu khi click vô tình: tổng chiều dài nét vẽ < 15px
    const totalLen = pathLength(rawPoints);
    if (!Number.isFinite(totalLen)) return { status: 'invalid_input' };
    if (totalLen < this.minPathLength) {
      return { status: 'too_short' };
    }

    // 3. Resampling nét vẽ về đúng 32 điểm
    const resampled = resample(rawPoints, this.pointCount);

    // 4. Lưu thông số Bounding Box nét gốc để dùng cho Heuristic Gate
    const rawBox = getBoundingBox(rawPoints);

    // 5. Bounding Box Normalization về 100x100
    const normalized = normalizeBoundingBox(resampled, this.boxSize, this.oneDThreshold);

    // 6. Tính toán Template Matching (Thuật toán Dollar $1 với khoảng cách Euclidean)
    // Đường chéo tham chiếu của ô 100x100 là 100 * sqrt(2) ≈ 141.42
    const halfDiagonal = 0.5 * Math.SQRT2 * this.boxSize;

    let bestGesture = null;
    let bestScore = -Infinity;
    const perGesture = {};

    for (const template of this.templates) {
      const avgDist = pathDistance(normalized, template.points);
      // Điểm số chuẩn hóa 0..1 (score = 1 - d / (0.5 * diagonal))
      const score = Math.max(0, 1 - avgDist / halfDiagonal);

      if (perGesture[template.name] === undefined || score > perGesture[template.name]) {
        perGesture[template.name] = score;
      }
      if (score > bestScore) {
        bestScore = score;
        bestGesture = template.name;
      }
    }

    return { status: 'ok', rawBox, normalized, bestGesture, bestScore, perGesture };
  }

  /**
   * Đổi mức độ nhạy nhận diện (ngưỡng điểm tối thiểu).
   * @param {'easy'|'normal'|'strict'} level
   */
  setSensitivity(level = 'normal') {
    const value = SENSITIVITY_LEVELS[level];
    if (value !== undefined) this.minScore = value;
  }

  /**
   * Phương thức nhận diện cử chỉ chính
   *
   * Khi không nhận diện được (gesture === null), kết quả còn kèm:
   *  - candidate: cử chỉ giống nét vẽ nhất (hoặc null nếu không có gì đáng kể)
   *  - reason: vì sao thất bại ('no_input' | 'too_short' | 'low_score' | mã lỗi hình học)
   * để UI có thể hướng dẫn người chơi sửa nét vẽ.
   *
   * @param {Array<{x: number, y: number, timestamp?: number}>} rawPoints Mảng các điểm thu thập từ Pointer Events
   * @returns {{ gesture: string | null, score: number, candidate: string | null, reason: string | null }}
   */
  recognize(rawPoints) {
    return this._recognizeAnalysis(this._analyze(rawPoints));
  }

  _recognizeAnalysis(a) {
    if (a.status !== 'ok') {
      return { gesture: null, score: 0, confidence: 0, margin: 0, candidate: null, reason: a.status };
    }

    const { bestGesture, bestScore, rawBox, normalized } = a;
    const roundedBest = Number(Math.max(0, bestScore).toFixed(3));
    const runnerUp = Math.max(0, ...Object.entries(a.perGesture)
      .filter(([name]) => name !== bestGesture && !this._checkGeometry(name, rawBox, normalized))
      .map(([, score]) => score));
    const margin = Math.max(0, bestScore - runnerUp);
    const details = { confidence: roundedBest, margin: Number(margin.toFixed(3)) };

    // 7. Xác thực hình học (Heuristic Validation Gate)
    const geometryFail = bestGesture ? this._checkGeometry(bestGesture, rawBox, normalized) : null;
    if (geometryFail) {
      return { gesture: null, score: roundedBest, ...details, candidate: bestGesture, reason: geometryFail };
    }

    // 8. So sánh với ngưỡng chấp nhận (Threshold Filter)
    if (bestScore < Math.max(this.minScore, this.thresholds[bestGesture] ?? 0)) {
      return { gesture: null, score: roundedBest, ...details, candidate: bestGesture, reason: 'low_score' };
    }

    if (margin < this.minMargin) {
      return { gesture: null, score: roundedBest, ...details, candidate: bestGesture, reason: 'ambiguous' };
    }
    return {
      ...details,
      gesture: bestGesture,
      score: Number(bestScore.toFixed(3)),
      candidate: bestGesture,
      reason: null
    };
  }

  /**
   * Chấm một nét vẽ theo MỘT cử chỉ mục tiêu (dùng cho Phòng Luyện Vẽ).
   *
   * @param {Array<{x: number, y: number}>} rawPoints
   * @param {string} target Tên cử chỉ cần luyện
   * @returns {{ passed: boolean, accuracy: number, recognizedAs: string|null, reason: string|null }}
   *   accuracy: độ giống 0..1 với mẫu của cử chỉ mục tiêu (0 nếu nét quá ngắn)
   *   reason: null khi đạt; ngược lại là mã lý do (xem getMissHint)
   */
  scoreFor(rawPoints, target) {
    const a = this._analyze(rawPoints);
    if (a.status !== 'ok') {
      return { passed: false, accuracy: 0, recognizedAs: null, reason: a.status };
    }

    const accuracy = Number((a.perGesture[target] || 0).toFixed(3));
    const recognized = this._recognizeAnalysis(a);
    const passed = recognized.gesture === target;

    let reason = null;
    if (!passed) {
      const geometryFail = this._checkGeometry(target, a.rawBox, a.normalized);
      if (geometryFail) reason = geometryFail;
      else if (recognized.gesture && recognized.gesture !== target) reason = 'confused';
      else reason = recognized.reason || 'low_score';
    }

    return { passed, accuracy, recognizedAs: recognized.gesture, reason };
  }
}

// Ngưỡng điểm tối thiểu theo mức độ nhạy (easy = dễ tính, strict = chặt)
export const SENSITIVITY_LEVELS = {
  easy: 0.55,
  normal: 0.65,
  strict: 0.75
};

/**
 * Nét mẫu "chuẩn" (toạ độ 0..100) dùng để vẽ lớp phủ hướng dẫn.
 * @param {string} gesture
 * @returns {Array<{x: number, y: number}>} mảng rỗng nếu cử chỉ không tồn tại
 */
export function getGuideStroke(gesture) {
  const list = DEFAULT_RAW_TEMPLATES[gesture];
  if (!list || list.length === 0) return [];
  // Chọn mẫu dễ đọc nhất cho từng cử chỉ (mẫu đầu tiên là chuẩn, trừ tia sét: chọn nét dựng đứng kinh điển)
  const preferred = gesture === 'lightning' ? list[4] : list[0];
  return preferred.map(p => ({ x: p.x, y: p.y }));
}

/** Mẹo vẽ ngắn gọn cho từng cử chỉ (hiển thị trong Phòng Luyện Vẽ). */
export const GESTURE_TIPS = {
  horizontal: 'Kéo một đường thẳng ngang, từ trái sang phải (hoặc ngược lại).',
  vertical: 'Kéo một đường thẳng đứng, từ trên xuống dưới (hoặc ngược lại).',
  caret: 'Vẽ nét đi lên rồi bẻ góc đi xuống, đỉnh nhọn ở chính giữa (∧).',
  v_shape: 'Vẽ nét đi xuống rồi bẻ góc đi lên, đáy nhọn ở chính giữa (∨).',
  lightning: 'Vẽ nét gấp khúc zíc-zắc nhọn, ít nhất 2 lần đổi hướng (⚡).',
  heart: 'Vẽ liền một nét hình trái tim, hai thuỳ trên và mũi nhọn ở đáy.',
  circle: 'Vẽ một vòng tròn gần khép kín, điểm đầu và cuối gần nhau.',
  spiral: 'Vẽ một nét xoắn ốc cuộn vào trong (hoặc xoáy ra ngoài), ít nhất 1 vòng rưỡi.'
};

const MISS_HINTS = {
  ambiguous: 'Nét giống nhiều ấn ký — vẽ rõ góc hoặc vòng xoắn hơn',
  invalid_input: 'Nét bị gián đoạn — thử vẽ lại một nét liền',
  too_complex: 'Nét quá dài — thử vẽ gọn hơn',
  too_short: 'Nét quá ngắn — kéo dài tay ra hơn',
  tilted: 'Nét bị nghiêng — giữ tay thẳng hơn',
  short: 'Nét chưa đủ dài — vẽ dài và dứt khoát hơn',
  off_center: 'Điểm bẻ góc chưa ở chính giữa — bẻ ngay giữa nét',
  shallow: 'Góc bẻ còn nông — bẻ góc nhọn và sâu hơn',
  no_zigzag: 'Chưa đủ gấp khúc — đổi hướng nhọn ít nhất 2 lần',
  bad_ratio: 'Hình bị dẹt — vẽ đều cả chiều rộng lẫn chiều cao',
  open: 'Vòng chưa khép — kéo điểm cuối về gần điểm đầu',
  low_score: 'Nét hơi lệch — vẽ gọn và rõ góc hơn',
  confused: 'Bị nhận nhầm sang ấn ký khác — vẽ rõ hình hơn'
};

/**
 * Câu gợi ý (tiếng Việt) giúp người chơi sửa nét vẽ.
 *
 * @param {string|null} reason Mã lý do từ GestureEngine.recognize()/scoreFor()
 * @param {string|null} [candidate] Cử chỉ giống nét vẽ nhất
 * @param {number} [score=0] Độ giống với candidate (0..1)
 * @returns {string|null} null khi không có gì để gợi ý (vd. chạm nhầm, nét quá ngắn do click)
 */
export function getMissHint(reason, candidate = null, score = 0) {
  if (!reason || reason === 'no_input') return null;
  const body = MISS_HINTS[reason];
  if (!body) return null;
  if (reason === 'too_short') return body;

  const rune = candidate && RUNES[candidate] ? RUNES[candidate] : null;
  // Nét quá khác mọi mẫu: đừng khẳng định "giống X" khi thật ra không giống gì
  if (!rune || score < 0.35) {
    return reason === 'low_score' ? 'Chưa rõ hình ấn ký nào — thử vẽ chậm và rõ nét hơn' : body;
  }
  return `Giống ${rune.name} (${rune.symbol}): ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
}

export default GestureEngine;
