import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '이용약관 · SOOM',
  description: 'SOOM 서비스 이용약관, 개인정보 처리방침, 환불 정책.',
}

/* 이용약관 한 장.

   약관·개인정보·환불을 각각 다른 주소로 두면 푸터 링크가 셋이 되고,
   읽는 사람은 어느 것을 봐야 할지 묻게 된다. 한 장에 쌓고 위쪽에
   건너뛰는 링크를 둔다 — 푸터에서는 '이용약관' 하나만 걸면 된다.

   내용은 ref(/Users/cy/balance/agency/public)의 방침을 옮기되,
   저쪽은 개발 용역 에이전시이고 여기는 디자이너와 고객을 잇는
   플랫폼이라 맞지 않는 조항은 고쳐 적었다. */

const UPDATED = '2026년 10월 25일'

export default function TermsPage() {
  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <header className="border-b border-neutral-200 pb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">이용약관</h1>
          <p className="mt-2 text-sm text-neutral-500">시행일 {UPDATED}</p>

          {/* 긴 문서라 먼저 어디에 무엇이 있는지 보여준다 */}
          <nav className="mt-6 flex flex-wrap gap-2">
            {[
              ['terms', '서비스 이용약관'],
              ['privacy', '개인정보 처리방침'],
              ['refund', '환불 정책'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium transition hover:border-neutral-900"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        {/* ─────────── 이용약관 ─────────── */}
        <Doc id="terms" title="서비스 이용약관">
          <Section n="01" title="목적">
            <P>
              이 약관은 밸런스(이하 &ldquo;회사&rdquo;)가 운영하는 SOOM(이하
              &ldquo;서비스&rdquo;)의 이용 조건과 절차, 회사와 이용자의 권리·의무를 정합니다.
            </P>
          </Section>

          <Section n="02" title="서비스의 성격">
            <P>
              서비스는 디자인 시안이 필요한 고객과 디자이너를 잇는 중개 플랫폼입니다. 회사는
              거래의 당사자가 아니며, 디자이너가 제작한 결과물의 품질과 납기에 대한 책임은
              디자이너에게 있습니다.
            </P>
            <P>
              다만 회사는 디자이너의 등록을 심사하고, 분쟁이 생겼을 때 양측의 의견을 듣고
              조정을 돕습니다.
            </P>
          </Section>

          <Section n="03" title="디자이너 등록">
            <P>디자이너로 활동하려면 회사의 심사를 거쳐야 합니다. 등록 시 다음을 확인합니다.</P>
            <Ul
              items={[
                'Figma로 웹 디자인이 가능한지',
                '실무 경력 6개월 이상 또는 디자인 전공(3학년 이상)이면서 웹 포트폴리오 보유',
                '제출한 포트폴리오가 본인의 작업물인지',
              ]}
            />
            <P>
              등록 후 회사가 발급한 임시 비밀번호로 처음 로그인하며, 디자이너는 즉시 비밀번호를
              변경해야 합니다. 계정 정보의 관리 책임은 디자이너에게 있습니다.
            </P>
          </Section>

          <Section n="04" title="포트폴리오 게시">
            <P>
              디자이너가 올린 작업물은 서비스의 탐색·상세 화면에 공개됩니다. 디자이너는 다음을
              보장해야 합니다.
            </P>
            <Ul
              items={[
                '본인이 제작했거나 게시 권한이 있는 작업물일 것',
                '타인의 저작권·상표권을 침해하지 않을 것',
                '클라이언트와의 비밀유지 약정을 위반하지 않을 것',
                'AI를 활용한 작업은 업로드 시 그 사실을 표시할 것',
              ]}
            />
            <P>
              위 사항을 위반한 작업물은 회사가 사전 통보 없이 비공개 처리할 수 있으며, 반복되면
              계정을 정지할 수 있습니다. 작업물의 저작권은 디자이너에게 있고, 회사는 서비스
              운영·홍보 목적의 게시 권한만 가집니다.
            </P>
          </Section>

          <Section n="05" title="의뢰와 계약">
            <P>
              고객이 서비스에서 보낸 문의는 의뢰 의사를 전달하는 단계이며, 그 자체로 계약이
              성립하지는 않습니다. 작업 범위·금액·일정은 디자이너와 고객이 협의해 확정합니다.
            </P>
            <P>
              시안 제작 금액은 건당 29,000원부터이며, 구체적인 금액은 디자이너가 정한 플랜과
              작업 범위에 따릅니다.
            </P>
          </Section>

          <Section n="06" title="금지 행위">
            <Ul
              items={[
                '타인의 정보를 도용하거나 허위 정보를 등록하는 행위',
                '서비스를 거치지 않고 거래를 유도해 수수료를 회피하는 행위',
                '자동화된 수단으로 서비스에 접근하거나 과도한 부하를 일으키는 행위',
                '다른 이용자를 비방하거나 영업을 방해하는 행위',
              ]}
            />
          </Section>

          <Section n="07" title="면책">
            <P>
              회사는 천재지변, 정전, 통신 장애 등 불가항력으로 서비스를 제공하지 못한 경우 책임을
              지지 않습니다. 이용자 사이에 생긴 분쟁에 대해서도 회사의 고의·중과실이 없는 한
              책임을 지지 않습니다.
            </P>
          </Section>

          <Section n="08" title="약관 변경">
            <P>
              이 약관이 변경되는 경우, 변경 사항을 시행 7일 전부터 이 페이지에 게시해
              안내합니다. 이용자에게 불리한 변경은 30일 전부터 안내합니다.
            </P>
          </Section>
        </Doc>

        {/* ─────────── 개인정보 처리방침 ─────────── */}
        <Doc id="privacy" title="개인정보 처리방침">
          <P className="mb-8">
            회사는 서비스 제공에 필요한 최소한의 개인정보만 수집하며, 수집한 정보를 아래 목적
            외에 사용하지 않습니다.
          </P>

          <Section n="01" title="수집하는 항목과 목적">
            <p className="mb-3 text-sm font-medium text-neutral-700">의뢰 문의</p>
            <Table
              rows={[
                ['필수', '성함(회사명), 이메일, 연락처, 의뢰 유형, 문의 내용'],
                ['선택', '첨부 파일(기획서·참고 자료 등)'],
                ['목적', '문의 응대, 디자이너 연결, 견적 안내'],
              ]}
            />

            <p className="mb-3 mt-6 text-sm font-medium text-neutral-700">디자이너 등록</p>
            <Table
              rows={[
                ['필수', '이메일, 이름, 비밀번호'],
                [
                  '선택',
                  '프로필 사진, 한 줄 소개, 소개글, 전문 분야, 작업물 이미지와 설명, 가격 플랜',
                ],
                ['자동 수집', '최종 로그인 일시, 접속 기록'],
                ['목적', '계정 관리, 포트폴리오 공개, 의뢰 연결, 정산 안내'],
              ]}
            />

            <P className="mt-5">
              주민등록번호 등 고유식별정보는 수집하지 않으며, 쿠키를 이용한 행태정보 수집이나
              광고 추적도 하지 않습니다. 로그인 유지에 필요한 쿠키만 사용합니다.
            </P>
          </Section>

          <Section n="02" title="보유 기간">
            <Ul
              items={[
                '의뢰 문의 — 처리가 끝난 날부터 1년간 보관 후 파기',
                '디자이너 계정 — 탈퇴 또는 등록 해지 시까지 보관, 이후 지체 없이 파기',
                '계약이 체결된 경우 — 관계 법령이 정한 기간 동안 보관',
              ]}
            />
            <P>
              파기할 때 전자적 파일은 복구할 수 없는 방법으로 삭제하고, 출력물은 분쇄하거나
              소각합니다.
            </P>
          </Section>

          <Section n="03" title="제3자 제공 및 처리위탁">
            <P>
              회사는 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 수사기관이 적법한
              절차로 요청하는 경우는 예외로 합니다.
            </P>
            <P>
              의뢰 문의가 특정 디자이너를 지정해 들어온 경우, 응대에 필요한 범위에서 해당
              디자이너에게 문의 내용을 전달합니다.
            </P>
            <P>서비스 운영을 위해 아래 업체에 처리를 위탁하고 있습니다.</P>
            <Table
              rows={[
                ['Supabase', '데이터 보관, 파일 저장'],
                ['Resend', '메일 발송'],
                ['Vercel', '서비스 호스팅'],
              ]}
            />
          </Section>

          <Section n="04" title="이용자의 권리">
            <P>이용자는 언제든지 자신의 개인정보에 대해 다음을 요구할 수 있습니다.</P>
            <Ul items={['열람 및 처리 현황 확인', '오류가 있는 경우 정정', '삭제 및 처리 정지']} />
            <P>
              아래 연락처로 요청하시면 지체 없이 조치하고 결과를 알려드립니다. 디자이너는 관리
              페이지에서 프로필과 작업물을 직접 고치거나 숨길 수 있습니다.
            </P>
          </Section>

          <Section n="05" title="안전조치">
            <P>
              개인정보에 접근할 수 있는 인원을 담당자로 제한하고, 전송 구간은 암호화된
              연결(HTTPS)을 사용합니다. 비밀번호는 복호화할 수 없는 방식으로 저장하며, 문의
              첨부 파일은 비공개 저장소에 두고 기한이 있는 링크로만 엽니다.
            </P>
          </Section>

          <Section n="06" title="방침 변경">
            <P>
              이 방침이 변경되는 경우, 변경 사항을 시행 7일 전부터 이 페이지에 게시해
              안내합니다.
            </P>
          </Section>
        </Doc>

        {/* ─────────── 환불 정책 ─────────── */}
        <Doc id="refund" title="환불 정책">
          <Section n="01" title="총칙">
            <P>
              이 환불 정책은 서비스를 통해 이루어지는 디자인 시안 제작의 취소·환불 기준을
              정합니다. 디자이너와 고객이 개별 계약에서 달리 정한 경우 개별 계약이 우선합니다.
            </P>
          </Section>

          <Section n="02" title="시안 제작의 취소·환불">
            <Table
              rows={[
                ['작업 착수 전', '전액 환불'],
                ['작업 착수 후', '진행도에 따라 50% 이내 환불'],
                ['시안 전달 후', '환불 불가'],
              ]}
            />
            <P>
              <B>작업 착수</B>는 디자이너가 고객과 요구사항을 확정하고 디자인 작업을 시작한
              시점을 말합니다. 시안은 고객의 요청에 따라 개별 제작되는 주문 제작 상품이므로
              전달 후에는 환불이 불가합니다.
            </P>
          </Section>

          <Section n="03" title="본 계약으로 이어진 경우">
            <Ul
              items={[
                '착수 전 취소 — 기지급 대금 전액 환불',
                '착수 후 중도 해지 — 수행된 업무 비율과 위약금 10%를 공제한 잔액 환불',
                '최종 인도 후 — 환불 불가. 계약 범위 내 하자는 무상 보수로 처리',
                '디자이너 귀책 시 — 미수행 부분에 해당하는 대금 전액 환불',
              ]}
            />
            <P>
              수행된 업무 비율은 투입 공수와 산출물을 기준으로 양측이 상호 확인해 정합니다.
            </P>
          </Section>

          <Section n="04" title="환불 절차">
            <Ul
              items={[
                '환불 요청은 아래 이메일로 접수합니다. 계약명, 요청 사유, 환불 수령 정보를 함께 알려주세요.',
                '접수일로부터 10영업일 이내에 환불 금액과 일정을 협의·확정합니다.',
                '확정된 금액은 확정일로부터 7영업일 이내에 지급합니다.',
              ]}
            />
          </Section>

          <Section n="05" title="결제수단별 환불 방법">
            <Ul
              items={[
                '계좌이체 — 고객이 지정한 계좌로 입금',
                '신용카드 등 PG 결제 — 승인 취소 또는 부분 취소. 카드사·PG사 정책에 따라 반영까지 3~7영업일 소요',
              ]}
            />
          </Section>

          <Section n="06" title="기타">
            <P>
              이 정책에서 정하지 않은 사항은 「전자상거래 등에서의 소비자보호에 관한 법률」,
              공정거래위원회 소비자분쟁해결기준 등 관련 법령을 따릅니다.
            </P>
          </Section>
        </Doc>

        {/* 문의처 — 세 문서가 모두 가리키므로 맨 아래 한 번만 둔다 */}
        <div className="mt-12 rounded-xl bg-neutral-100 p-6">
          <p className="text-sm font-semibold">문의처</p>
          <dl className="mt-3 space-y-1.5 text-sm text-neutral-600">
            <Line k="이메일">
              <a href="mailto:manager@soom.it" className="text-violet-600 hover:underline">
                manager@soom.it
              </a>
            </Line>
            <Line k="상호">밸런스</Line>
            <Line k="사업자등록번호">464-12-02831</Line>
            <Line k="사업장 소재지">서울 마포구 서교동 와우산로 162-10 2층</Line>
          </dl>
        </div>

        <div className="mt-8">
          <Link href="/" className="text-sm text-neutral-500 transition hover:text-neutral-900">
            ← 홈으로
          </Link>
        </div>
      </div>
    </main>
  )
}

/* ─────────── 부품 ─────────── */

function Doc({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    /* scroll-mt — 위쪽 네비바에 제목이 가려지지 않게 */
    <section id={id} className="scroll-mt-20 border-b border-neutral-200 py-10 last:border-b-0">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Section({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h3 className="flex items-baseline gap-2.5 text-base font-semibold">
        <span className="text-xs font-bold text-violet-600">{n}</span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mb-3 text-sm leading-relaxed text-neutral-600 last:mb-0 ${className}`}>
      {children}
    </p>
  )
}

function B({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-neutral-900">{children}</b>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mb-3 space-y-2 last:mb-0">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-neutral-600">
          <span className="shrink-0 text-neutral-400">·</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/* 라벨-내용 표 — 좁은 화면에서는 위아래로 쌓는다 */
function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="border-t border-neutral-200">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="grid gap-1 border-b border-neutral-200 py-3 text-sm sm:grid-cols-[8rem_1fr] sm:gap-4"
        >
          <dt className="font-medium text-neutral-900">{k}</dt>
          <dd className="leading-relaxed text-neutral-600">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="w-28 shrink-0 text-neutral-500">{k}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
