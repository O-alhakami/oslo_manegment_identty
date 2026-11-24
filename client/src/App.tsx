import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clipboard,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import type {
  EncryptedItemInput,
  VaultCategory,
  VaultItem,
  VaultPayload,
} from "./types";
import { apiRequest } from "./utils/api";
import { decryptPayload, encryptPayload } from "./utils/crypto";

const categoryLabels: Record<VaultCategory | "all", string> = {
  all: "الكل",
  password: "كلمات المرور",
  identity: "الهويات والبطاقات",
  note: "ملاحظات آمنة",
};

const emptyPayload: VaultPayload = {
  title: "",
  username: "",
  password: "",
  url: "",
  idNumber: "",
  notes: "",
};

function App() {
  const { token, encryptionKey } = useAuth();
  return token && encryptionKey ? <Dashboard /> : <AuthScreen />;
}

function AuthScreen() {
  const { login, register, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "register" && password.length < 12) {
      return;
    }
    if (mode === "register") await register(email, password);
    else await login(email, password);
  }

  function changeMode(next: "login" | "register") {
    setMode(next);
    clearError();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={23} /></div>
          <span>أمان</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">خصوصيتك، بيدك</span>
          <h1>{mode === "login" ? "مرحباً بعودتك" : "أنشئ خزنتك الآمنة"}</h1>
          <p>
            {mode === "login"
              ? "سجّل الدخول للوصول إلى هويتك الرقمية."
              : "كلمة مرور رئيسية واحدة لحماية كل شيء."}
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            البريد الإلكتروني
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              dir="ltr"
            />
          </label>
          <label>
            كلمة المرور الرئيسية
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 12 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
              dir="ltr"
            />
            {mode === "register" && (
              <span className="field-hint">استخدم 12 حرفاً على الأقل.</span>
            )}
          </label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="recovery-warning">
            <AlertTriangle size={18} />
            <p>
              <strong>تنبيه مهم:</strong> لا يمكن استعادة كلمة المرور الرئيسية.
              لا نملك نسخة منها، وفقدانها يعني فقدان الوصول إلى بيانات خزنتك.
            </p>
          </div>
          <button className="button button-primary auth-submit" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : mode === "login" ? (
              <><LockKeyhole size={18} /> تسجيل الدخول</>
            ) : (
              <><ShieldCheck size={18} /> إنشاء حساب آمن</>
            )}
          </button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
          <button
            type="button"
            onClick={() => changeMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "أنشئ حساباً" : "تسجيل الدخول"}
          </button>
        </div>
        <div className="auth-footnote"><LockKeyhole size={14} /> تشفير كامل على جهازك</div>
      </section>
      <aside className="auth-aside">
        <div className="aside-glow" />
        <div className="aside-icon"><Fingerprint size={34} /></div>
        <span className="eyebrow">مساحة رقمية خاصة</span>
        <h2>أمانك الرقمي<br />يبدأ من هنا.</h2>
        <p>
          بياناتك تُشفّر على جهازك قبل أن تغادره. لا يستطيع أحد — حتى نحن —
          قراءة محتويات خزنتك.
        </p>
        <div className="aside-proof"><span /><span /><span /> خصوصية بلا تنازلات</div>
      </aside>
    </main>
  );
}

function Dashboard() {
  const { token, encryptionKey, logout } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalItem, setModalItem] = useState<VaultItem | null | undefined>(undefined);
  const [toast, setToast] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token || !encryptionKey) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    apiRequest<{ items: Omit<VaultItem, "payload">[] }>("/api/vault", {}, token)
      .then(async ({ items: encryptedItems }) => {
        const decrypted = await Promise.all(
          encryptedItems.map(async (item) => ({
            ...item,
            payload: await decryptPayload(
              item.encrypted_data,
              item.iv,
              encryptionKey,
            ),
          })),
        );
        if (active) setItems(decrypted);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "تعذر تحميل الخزنة.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, encryptionKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const inCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      return inCategory && (!query || item.payload.title.toLocaleLowerCase().includes(query));
    });
  }, [items, search, selectedCategory]);

  async function saveItem(
    category: VaultCategory,
    payload: VaultPayload,
    existing?: VaultItem,
  ) {
    if (!token || !encryptionKey) return;
    const encrypted = await encryptPayload(payload, encryptionKey);
    const input: EncryptedItemInput = { category, ...encrypted };
    const response = await apiRequest<{ item: Omit<VaultItem, "payload"> }>(
      existing ? `/api/vault/${existing.id}` : "/api/vault",
      {
        method: existing ? "PUT" : "POST",
        body: JSON.stringify(input),
      },
      token,
    );
    const saved: VaultItem = { ...response.item, payload };
    setItems((current) =>
      existing
        ? current.map((item) => (item.id === existing.id ? saved : item))
        : [saved, ...current],
    );
    setModalItem(undefined);
    setToast(existing ? "تم تحديث العنصر بأمان" : "تمت إضافة العنصر إلى خزنتك");
  }

  async function deleteItem(item: VaultItem) {
    if (!token || !window.confirm(`هل تريد حذف "${item.payload.title}"؟`)) return;
    try {
      await apiRequest<void>(`/api/vault/${item.id}`, { method: "DELETE" }, token);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setToast("تم حذف العنصر");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر حذف العنصر");
    }
  }

  async function copyPassword(item: VaultItem) {
    if (!item.payload.password) {
      setToast("لا توجد كلمة مرور لهذا العنصر");
      return;
    }
    try {
      await navigator.clipboard.writeText(item.payload.password);
      setToast("تم نسخ كلمة المرور");
    } catch {
      setToast("تعذر النسخ. تحقق من صلاحية الحافظة في المتصفح.");
    }
  }

  function togglePassword(id: string) {
    setVisiblePasswords((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const counts = {
    all: items.length,
    password: items.filter((item) => item.category === "password").length,
    identity: items.filter((item) => item.category === "identity").length,
    note: items.filter((item) => item.category === "note").length,
  };

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><ShieldCheck size={22} /></div><span>أمان</span></div>
        <div className="sidebar-caption">خزنتك</div>
        <nav className="category-nav" aria-label="تصنيفات الخزنة">
          {(Object.keys(categoryLabels) as Array<VaultCategory | "all">).map((category) => {
            const Icon = category === "all" ? LockKeyhole : category === "password" ? KeyRound : category === "identity" ? UserRound : StickyNote;
            return (
              <button
                key={category}
                className={`nav-item ${selectedCategory === category ? "active" : ""}`}
                onClick={() => setSelectedCategory(category)}
              >
                <Icon size={18} />
                <span>{categoryLabels[category]}</span>
                <small>{counts[category]}</small>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="encryption-badge">
            <div className="badge-icon"><ShieldCheck size={16} /></div>
            <div><strong>خزنتك محمية</strong><span>تشفير AES-256-GCM</span></div>
            <Check size={15} className="badge-check" />
          </div>
          <button className="logout-button" onClick={logout}><LogOut size={17} /> تسجيل الخروج</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>مساحة العمل</span><span className="crumb-slash">/</span><strong>{categoryLabels[selectedCategory]}</strong></div>
          <div className="topbar-right">
            <span className="secure-indicator"><span /> اتصال آمن</span>
            <div className="avatar">أ</div>
          </div>
        </header>
        <section className="vault-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">مساحتك الخاصة</span>
              <h1>خزنتك الرقمية</h1>
              <p>كل معلوماتك المهمة، مشفّرة وآمنة في مكان واحد.</p>
            </div>
            <button className="button button-primary add-button" onClick={() => setModalItem(null)}>
              <Plus size={18} /> إضافة عنصر
            </button>
          </div>

          <div className="welcome-strip">
            <div className="welcome-icon"><Sparkles size={20} /></div>
            <div><strong>أهلاً بك في مساحتك الآمنة</strong><span>تُفكّ بياناتك على جهازك فقط — ابحث في خزنتك دون إرسال محتواها إلى الخادم.</span></div>
            <ArrowUpRight size={17} className="welcome-arrow" />
          </div>

          <div className="list-toolbar">
            <div className="search-field">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في العناصر..."
                aria-label="ابحث في العناصر"
              />
              {search && <button aria-label="مسح البحث" onClick={() => setSearch("")}><X size={15} /></button>}
            </div>
            <div className="result-count">{filteredItems.length} عناصر</div>
          </div>

          {loading ? (
            <div className="state-card loading-state"><span className="spinner" /><strong>جارٍ الاتصال بالخادم...</strong><span>قد يستغرق تشغيل الخادم لحظات قليلة.</span></div>
          ) : loadError ? (
            <div className="state-card error-state"><AlertTriangle size={24} /><strong>تعذر تحميل الخزنة</strong><span>{loadError}</span><button className="button button-secondary" onClick={() => window.location.reload()}>إعادة المحاولة</button></div>
          ) : filteredItems.length === 0 ? (
            <div className="state-card empty-state">
              <div className="empty-icon"><LockKeyhole size={26} /></div>
              <strong>{search ? "لا توجد نتائج مطابقة" : "خزنتك جاهزة لك"}</strong>
              <span>{search ? "جرّب البحث بكلمات مختلفة." : "أضف أول عنصر لحفظ كلمات المرور والهويات والملاحظات بأمان."}</span>
              {!search && <button className="button button-secondary" onClick={() => setModalItem(null)}><Plus size={17} /> أضف أول عنصر</button>}
            </div>
          ) : (
            <div className="vault-grid">
              {filteredItems.map((item) => (
                <VaultCard
                  key={item.id}
                  item={item}
                  passwordVisible={visiblePasswords.has(item.id)}
                  onTogglePassword={() => togglePassword(item.id)}
                  onCopy={() => void copyPassword(item)}
                  onEdit={() => setModalItem(item)}
                  onDelete={() => void deleteItem(item)}
                />
              ))}
            </div>
          )}
          <footer className="dashboard-footer"><LockKeyhole size={14} /> بياناتك مشفّرة قبل إرسالها — لا يمكن للخادم قراءتها</footer>
        </section>
      </main>
      {modalItem !== undefined && (
        <ItemModal
          key={modalItem?.id ?? "new-item"}
          item={modalItem}
          onClose={() => setModalItem(undefined)}
          onSave={saveItem}
        />
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function VaultCard({
  item,
  passwordVisible,
  onTogglePassword,
  onCopy,
  onEdit,
  onDelete,
}: {
  item: VaultItem;
  passwordVisible: boolean;
  onTogglePassword: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = item.category === "password" ? KeyRound : item.category === "identity" ? UserRound : StickyNote;
  const passwordText = passwordVisible
    ? item.payload.password || "—"
    : item.payload.password
      ? "••••••••••••"
      : "—";

  return (
    <article className="vault-card">
      <div className="card-top">
        <div className={`item-icon category-${item.category}`}><Icon size={19} /></div>
        <span className={`category-tag category-tag-${item.category}`}>{categoryLabels[item.category]}</span>
        <div className="card-actions">
          <button title="تعديل" aria-label={`تعديل ${item.payload.title}`} onClick={onEdit}><PencilIcon /></button>
          <button title="حذف" aria-label={`حذف ${item.payload.title}`} onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </div>
      <h2>{item.payload.title}</h2>
      {item.payload.url && <a className="item-url" href={safeExternalUrl(item.payload.url)} target="_blank" rel="noreferrer">{item.payload.url}<ArrowUpRight size={12} /></a>}
      <div className="card-separator" />
      {(item.payload.username || item.payload.idNumber) && (
        <div className="item-detail"><span>{item.payload.idNumber ? "رقم الهوية" : "اسم المستخدم"}</span><strong dir="ltr">{item.payload.idNumber || item.payload.username}</strong></div>
      )}
      {item.payload.password && (
        <div className="item-detail password-detail">
          <span>كلمة المرور</span>
          <div className="password-value" dir="ltr">
            <strong>{passwordText}</strong>
            <button title={passwordVisible ? "إخفاء" : "إظهار"} aria-label={passwordVisible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} onClick={onTogglePassword}>{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            <button title="نسخ كلمة المرور" aria-label="نسخ كلمة المرور" onClick={onCopy}><Clipboard size={15} /></button>
          </div>
        </div>
      )}
      {item.payload.notes && <p className="item-notes">{item.payload.notes}</p>}
      <div className="card-updated">آخر تحديث {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(item.updated_at))}</div>
    </article>
  );
}

function PencilIcon() {
  return <span className="pencil-icon">✎</span>;
}

function safeExternalUrl(value: string): string {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "#";
  } catch {
    return "#";
  }
}

function ItemModal({
  item,
  onClose,
  onSave,
}: {
  item: VaultItem | null;
  onClose: () => void;
  onSave: (
    category: VaultCategory,
    payload: VaultPayload,
    existing?: VaultItem,
  ) => Promise<void>;
}) {
  const [category, setCategory] = useState<VaultCategory>(item?.category ?? "password");
  const [payload, setPayload] = useState<VaultPayload>(item?.payload ?? emptyPayload);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof VaultPayload, value: string) {
    setPayload((current) => ({ ...current, [field]: value }));
  }

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=?";
    const result: string[] = [];
    const bytes = new Uint8Array(32);
    const acceptedByteLimit = Math.floor(256 / alphabet.length) * alphabet.length;
    while (result.length < 20) {
      crypto.getRandomValues(bytes);
      for (const byte of bytes) {
        if (byte < acceptedByteLimit) result.push(alphabet[byte % alphabet.length]);
        if (result.length === 20) break;
      }
    }
    update("password", result.join(""));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(category, payload, item ?? undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ العنصر.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div><span className="eyebrow">{item ? "تحديث بياناتك" : "عنصر جديد"}</span><h2 id="modal-title">{item ? "تعديل العنصر" : "أضف إلى خزنتك"}</h2></div>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-label">نوع العنصر</label>
          <div className="category-picker">
            {(["password", "identity", "note"] as VaultCategory[]).map((value) => (
              <button type="button" className={category === value ? "selected" : ""} key={value} onClick={() => setCategory(value)}>
                {value === "password" ? <KeyRound size={16} /> : value === "identity" ? <UserRound size={16} /> : <StickyNote size={16} />}
                {categoryLabels[value]}
              </button>
            ))}
          </div>
          <label className="form-label">العنوان <span>*</span>
            <input required maxLength={120} value={payload.title} onChange={(event) => update("title", event.target.value)} placeholder="مثال: حساب البريد الإلكتروني" />
          </label>
          {category === "password" && (
            <>
              <label className="form-label">اسم المستخدم أو البريد
                <input dir="ltr" value={payload.username} onChange={(event) => update("username", event.target.value)} placeholder="name@example.com" />
              </label>
              <label className="form-label">كلمة المرور
                <div className="input-with-actions">
                  <input dir="ltr" type={showPassword ? "text" : "password"} value={payload.password} onChange={(event) => update("password", event.target.value)} placeholder="أدخل كلمة المرور" />
                  <button type="button" title={showPassword ? "إخفاء" : "إظهار"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  <button type="button" className="generate-button" onClick={generatePassword}><Sparkles size={15} /> إنشاء قوية</button>
                </div>
              </label>
              <label className="form-label">رابط الموقع
                <input dir="ltr" type="url" value={payload.url} onChange={(event) => update("url", event.target.value)} placeholder="https://example.com" />
              </label>
            </>
          )}
          {category === "identity" && (
            <>
              <label className="form-label">رقم الهوية أو البطاقة
                <input dir="ltr" value={payload.idNumber} onChange={(event) => update("idNumber", event.target.value)} placeholder="رقم الوثيقة" />
              </label>
              <label className="form-label">اسم المستخدم أو الجهة
                <input value={payload.username} onChange={(event) => update("username", event.target.value)} placeholder="الجهة المُصدرة" />
              </label>
            </>
          )}
          <label className="form-label">ملاحظات آمنة
            <textarea rows={3} maxLength={5000} value={payload.notes} onChange={(event) => update("notes", event.target.value)} placeholder="أضف تفاصيل تريد تذكرها..." />
          </label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="modal-security"><LockKeyhole size={15} /> سيتم تشفير هذا العنصر على جهازك قبل الحفظ.</div>
          <div className="modal-footer">
            <button type="button" className="button button-secondary" onClick={onClose}>إلغاء</button>
            <button type="submit" className="button button-primary" disabled={saving || !payload.title.trim()}>
              {saving ? <span className="spinner" /> : <><Check size={17} /> حفظ مشفّر</>}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
