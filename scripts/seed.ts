/**
 * Campus seed script
 * Run: npx tsx scripts/seed.ts
 *
 * Strategy: upsert reference rows on natural unique keys (domain, code, etc.),
 * then SELECT back the real UUIDs Postgres generated. IDs flow through function
 * return values -- no hardcoded fake-UUID strings anywhere.
 */

import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const result: T[] = []
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    result.push(copy.splice(idx, 1)[0])
  }
  return result
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function batchUpsert<T extends object>(
  table: string,
  rows: T[],
  conflict: string,
  label: string
) {
  if (rows.length === 0) return
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + BATCH) as never, {
        onConflict: conflict,
        ignoreDuplicates: true,
      })
    if (error) console.error(`  ${label} batch error:`, error.message)
  }
  console.log(`  ${label}: ${rows.length} rows`)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SeedUser = {
  email: string
  name: string
  major: string
  school: 'UCLA' | 'Berkeley'
  isTutor: boolean
  tutorCourseCodes: string[]
  gradYear: number
}

type CourseMap = { ucla: Record<string, string>; berk: Record<string, string> }
type OfferingMap = { ucla: Record<string, string>; berk: Record<string, string> }

// ---------------------------------------------------------------------------
// Static content (not IDs)
// ---------------------------------------------------------------------------

const MAJORS = [
  'Computer Science', 'Mathematics', 'Economics', 'Psychology', 'Statistics', 'Data Science',
]

const Q_TEMPLATES: [string, string][] = [
  ['How does {t1} differ from {t2}?', 'I have been studying for the midterm and cannot quite articulate the differences. Can someone break down when each approach is preferred and what the key trade-offs are?'],
  ['Stuck on problem set question involving {t1}', 'I understand the setup but my solution keeps failing the edge cases. Any hints on what invariant I should be maintaining throughout?'],
  ['Best way to study {t1} for the final?', 'First time taking this course. Is the exam more concept-heavy or computation-heavy? Should I focus on practice problems or derivations?'],
  ['Can someone clarify the intuition behind {t1}?', 'The lecture moved through this quickly. I can follow the steps but do not see the big picture. What is the underlying reason this result holds?'],
  ['What resources help with {t1} beyond the textbook?', 'The textbook is okay but I need more worked examples. Any YouTube channels or problem sets that pair well with this course?'],
  ['Is {t1} going to be on the midterm?', 'Got conflicting signals from different TAs. Anyone have clarity on whether this falls in scope?'],
  ['Office hours strategy for {t1}?', 'Going to office hours this week. What kinds of questions does the professor respond well to?'],
  ['Group study for {t1} this weekend?', 'Planning a session Saturday before the deadline. Would love to work through the harder problems together. Anyone in?'],
]

const TOPICS: Record<string, string[]> = {
  'Computer Science': ['dynamic programming', 'BFS and DFS', 'virtual memory and paging', 'context switching', 'LL(1) parsing', 'type inference', 'garbage collection', 'scheduling algorithms', 'deadlock prevention', 'cache coherence', 'lambda calculus'],
  'Mathematics':      ['epsilon-delta proofs', 'convergence of power series', 'linear independence', 'eigenvalue decomposition', 'Jacobian matrices', "Green's theorem", 'contraction mappings', 'Fourier series', 'change of basis'],
  'Psychology':       ['confounding variables', 'statistical power', 'within-subjects design', 'factorial ANOVA', 'regression assumptions', 'internal validity', 'meta-analysis'],
  'Economics':        ['marginal utility', 'Nash equilibrium', 'consumer surplus', 'price elasticity', 'general equilibrium', 'game theory', 'deadweight loss'],
  'EECS':             ['tail recursion', 'amortized analysis', 'Bayesian networks', 'gradient descent', 'decision trees', 'backpropagation', 'SQL query optimization'],
  'Data Science':     ['hypothesis testing', 'bootstrapping', 'feature engineering', 'bias-variance tradeoff', 'cross-validation'],
}

const ANSWER_BODIES = [
  'Great question. The key insight is to focus on the base case first. Once that is locked down, the inductive step follows by assuming the hypothesis holds for k and deriving it for k+1.',
  'I struggled with this too. Drawing the state diagram first helped a lot. The transitions make the invariant obvious once you can see them visually.',
  'Professor mentioned in office hours: always go back to the definition. If you can restate the problem using the original definition, the proof almost writes itself.',
  'Think about it this way: the algorithm is a depth-first traversal with memoization. Time drops from exponential to polynomial because each subproblem is only solved once.',
  'Check lecture notes from week 6, page 4. There is a worked example almost identical to this one. The trick is applying the triangle inequality at the key step.',
  'My approach: write down what you know and what you need to prove, then look for a lemma that bridges the gap. Theorem 3.4 in the textbook is the one you need.',
  'TA hint from section: do not memorize the formula. Understand where it comes from so you can re-derive it under exam pressure if you blank.',
  'The intuition is that you are trading space for time. Storing intermediate results costs O(n) memory but eliminates all redundant computation.',
  'Check your boundary conditions carefully and make sure the loop invariant actually holds after every iteration, not just at the end.',
  'Hint without spoiling: reduce to a simpler subproblem. Ask yourself if you can express the general case as a function of smaller instances you already know how to solve.',
  'The way I think about it: work backwards from what the output needs to be, then figure out what the input to the final step must have looked like.',
  'Came to office hours with this exact question last week. The professor said to draw it out concretely for a small case (n=3 or n=4), then generalize. It clicked immediately.',
  'There is a related result in section 4.2 of the textbook that makes this almost obvious once you see it. Read that first, then come back to this problem.',
  'Common mistake: people forget to verify the step holds at the boundary. The general case is fine but the argument breaks down at k=1 if you are not careful.',
  'I was confused too until I realized the two approaches are equivalent when the input is sorted. The lecture covered the unsorted case, which is why it seemed harder.',
]

const PROF_RATING_COMMENTS = [
  'Lectures are well-structured and he answers questions without making you feel dumb for asking. Exams are fair if you keep up with the material.',
  'Office hours are extremely valuable with this professor. Shows up prepared and works through your actual confusion instead of just re-explaining the slides.',
  'Grading is strict but transparent. The rubric is posted before each assignment and partial credit is applied consistently.',
  'The workload is heavier than the course description suggests, but the material is genuinely interesting if you are willing to put in the time.',
  'Best lecturer I have had at this school. Makes abstract concepts concrete with real examples and does not talk down to students.',
  'Exams are harder than the homework, which felt like a bait-and-switch. More practice problems at exam difficulty would help a lot.',
  'Very accessible during office hours and responds to emails quickly. The curve at the end saved a lot of people in the class.',
  'Would take this professor again for any course they teach. Has a real talent for breaking down hard topics without oversimplifying.',
  'Lectures are recorded, which is a lifesaver. The pace in person is fast but rewatching at 1.25x the night before helped a lot.',
  'Grading can feel inconsistent depending on which TA grades your work, but the professor is fair when you bring a regrade request.',
  'The curve is generous and she clearly wants you to succeed, but the midterms are calibrated harder than what was covered in lecture.',
  'Very research-focused, which means lectures sometimes feel tangential to the homework. Go to section instead if you need practical help.',
  'One of the more demanding courses in the department, but you come out of it actually knowing the material. Worth it if you can handle the load.',
]

const STUDY_GROUP_DESCRIPTIONS = [
  'Weekly problem set sessions, usually Sunday afternoon. Bring your current work and we go through the hard parts together.',
  'Focused on exam prep. We assign sections to each person to present, then work through questions as a group.',
  'Casual group for anyone who needs a low-pressure environment to work through the basics without judgment.',
  'We start each session with a timed practice problem, then debrief as a group. Good if you want to simulate exam conditions.',
  'Homework drop-in. Show up with whatever you are stuck on and the group works on it together. No commitment required.',
]

function topicFor(dept: string | null) {
  return pick(TOPICS[dept ?? 'Computer Science'] ?? TOPICS['Computer Science'])
}

function buildQ(dept: string | null) {
  const t1 = topicFor(dept)
  const t2 = topicFor(dept)
  const [tpl, body] = pick(Q_TEMPLATES)
  return {
    title: tpl.replace('{t1}', t1).replace('{t2}', t2),
    body:  body.replace('{t1}', t1),
  }
}

// ---------------------------------------------------------------------------
// 1. Schools
// Upsert on domain (unique), then SELECT to get real UUIDs.
// ---------------------------------------------------------------------------

async function seedSchools(): Promise<{ uclaId: string; berkId: string }> {
  console.log('\n[1/11] Schools')

  await supabase.from('schools').upsert(
    [
      { name: 'UCLA',        domain: 'ucla.edu',     state: 'CA' },
      { name: 'UC Berkeley', domain: 'berkeley.edu', state: 'CA' },
    ],
    { onConflict: 'domain', ignoreDuplicates: true }
  )

  const { data, error } = await supabase.from('schools').select('id, domain')
  if (error) throw error
  const uclaId = data!.find((s) => s.domain === 'ucla.edu')!.id
  const berkId = data!.find((s) => s.domain === 'berkeley.edu')!.id
  console.log('  UCLA:', uclaId)
  console.log('  UC Berkeley:', berkId)
  return { uclaId, berkId }
}

// ---------------------------------------------------------------------------
// 2. Professors
// Upsert on (school_id, first_name, last_name), SELECT back, return lastName -> id map.
// ---------------------------------------------------------------------------

async function seedProfessors(uclaId: string, berkId: string): Promise<Record<string, string>> {
  console.log('\n[2/11] Professors')

  const rows = [
    { school_id: uclaId, first_name: 'Todd',     last_name: 'Millstein',  department: 'Computer Science' },
    { school_id: uclaId, first_name: 'Jens',     last_name: 'Palsberg',   department: 'Computer Science' },
    { school_id: uclaId, first_name: 'Paul',     last_name: 'Eggert',     department: 'Computer Science' },
    { school_id: uclaId, first_name: 'David',    last_name: 'Smallberg',  department: 'Computer Science' },
    { school_id: uclaId, first_name: 'Carey',    last_name: 'Nachenberg', department: 'Computer Science' },
    { school_id: uclaId, first_name: 'Andrea',   last_name: 'Bertozzi',   department: 'Mathematics' },
    { school_id: uclaId, first_name: 'Luminita', last_name: 'Vese',       department: 'Mathematics' },
    { school_id: uclaId, first_name: 'Alan',     last_name: 'Castel',     department: 'Psychology' },
    { school_id: uclaId, first_name: 'Robert',   last_name: 'Bjork',      department: 'Psychology' },
    { school_id: uclaId, first_name: 'Ariel',    last_name: 'Burstein',   department: 'Economics' },
    { school_id: berkId, first_name: 'John',     last_name: 'DeNero',     department: 'EECS' },
    { school_id: berkId, first_name: 'Josh',     last_name: 'Hug',        department: 'EECS' },
    { school_id: berkId, first_name: 'Satish',   last_name: 'Rao',        department: 'EECS' },
  ]

  const { error } = await supabase
    .from('professors')
    .upsert(rows, { onConflict: 'school_id,first_name,last_name', ignoreDuplicates: true })
  if (error) throw error

  const { data, error: selErr } = await supabase.from('professors').select('id, last_name')
  if (selErr) throw selErr

  const map: Record<string, string> = {}
  for (const p of data ?? []) map[p.last_name.toLowerCase()] = p.id
  console.log('  professors:', Object.keys(map).length)
  return map
}

// ---------------------------------------------------------------------------
// 3. Courses
// Upsert on (school_id, code), SELECT back, return { ucla: {code -> id}, berk: {code -> id} }.
// ---------------------------------------------------------------------------

async function seedCourses(uclaId: string, berkId: string): Promise<CourseMap> {
  console.log('\n[3/11] Courses')

  const rows = [
    { school_id: uclaId, code: 'CS31',      title: 'Introduction to Computer Science I',                          department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS32',      title: 'Introduction to Computer Science II',                         department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS33',      title: 'Introduction to Computer Organization',                       department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS35L',     title: 'Software Construction Laboratory',                            department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS111',     title: 'Operating Systems Principles',                                department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS130',     title: 'Software Engineering',                                        department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS131',     title: 'Programming Languages',                                       department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS132',     title: 'Compiler Construction',                                       department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS143',     title: 'Compilers',                                                   department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'CS161',     title: 'Fundamentals of Artificial Intelligence',                     department: 'Computer Science', credits: 4 },
    { school_id: uclaId, code: 'MATH31A',   title: 'Differential and Integral Calculus',                         department: 'Mathematics',      credits: 4 },
    { school_id: uclaId, code: 'MATH31B',   title: 'Integration and Infinite Series',                            department: 'Mathematics',      credits: 4 },
    { school_id: uclaId, code: 'MATH32A',   title: 'Calculus of Several Variables',                              department: 'Mathematics',      credits: 4 },
    { school_id: uclaId, code: 'MATH33A',   title: 'Linear Algebra and Applications',                            department: 'Mathematics',      credits: 4 },
    { school_id: uclaId, code: 'MATH115A',  title: 'Linear Algebra',                                             department: 'Mathematics',      credits: 4 },
    { school_id: uclaId, code: 'ECON1',     title: 'Principles of Economics',                                     department: 'Economics',        credits: 5 },
    { school_id: uclaId, code: 'ECON11',    title: 'Microeconomic Theory',                                        department: 'Economics',        credits: 4 },
    { school_id: uclaId, code: 'ECON101',   title: 'Advanced Microeconomic Theory',                               department: 'Economics',        credits: 4 },
    { school_id: uclaId, code: 'PSYCH100A', title: 'Psychological Statistics',                                    department: 'Psychology',       credits: 4 },
    { school_id: uclaId, code: 'PSYCH100B', title: 'Research Methods in Psychology',                              department: 'Psychology',       credits: 4 },
    { school_id: berkId, code: 'CS61A',     title: 'Structure and Interpretation of Computer Programs',           department: 'EECS',             credits: 4 },
    { school_id: berkId, code: 'CS61B',     title: 'Data Structures',                                             department: 'EECS',             credits: 4 },
    { school_id: berkId, code: 'CS70',      title: 'Discrete Mathematics and Probability',                        department: 'EECS',             credits: 4 },
    { school_id: berkId, code: 'CS189',     title: 'Introduction to Machine Learning',                            department: 'EECS',             credits: 4 },
    { school_id: berkId, code: 'CS188',     title: 'Introduction to Artificial Intelligence',                     department: 'EECS',             credits: 4 },
    { school_id: berkId, code: 'MATH1A',    title: 'Calculus',                                                    department: 'Mathematics',      credits: 4 },
    { school_id: berkId, code: 'MATH54',    title: 'Linear Algebra and Differential Equations',                   department: 'Mathematics',      credits: 4 },
    { school_id: berkId, code: 'MATH110',   title: 'Linear Algebra',                                              department: 'Mathematics',      credits: 4 },
    { school_id: berkId, code: 'ECON1B',    title: 'Introduction to Economics',                                   department: 'Economics',        credits: 4 },
    { school_id: berkId, code: 'DATA8',     title: 'Foundations of Data Science',                                 department: 'Data Science',     credits: 4 },
  ]

  const { error } = await supabase
    .from('courses')
    .upsert(rows, { onConflict: 'school_id,code', ignoreDuplicates: true })
  if (error) throw error

  const { data, error: selErr } = await supabase
    .from('courses')
    .select('id, school_id, code')
  if (selErr) throw selErr

  const ucla: Record<string, string> = {}
  const berk: Record<string, string> = {}
  for (const c of data ?? []) {
    if (c.school_id === uclaId) ucla[c.code] = c.id
    else if (c.school_id === berkId) berk[c.code] = c.id
  }
  console.log(`  courses: ${Object.keys(ucla).length} UCLA + ${Object.keys(berk).length} Berkeley`)
  return { ucla, berk }
}

// ---------------------------------------------------------------------------
// 4. Offerings
// Upsert on (course_id, professor_id, semester, year), SELECT back,
// return { ucla: {courseCode -> offeringId}, berk: {courseCode -> offeringId} }.
// ---------------------------------------------------------------------------

async function seedOfferings(courses: CourseMap, profs: Record<string, string>): Promise<OfferingMap> {
  console.log('\n[4/11] Offerings (Spring 2026)')

  const p = profs

  const rows = [
    // UCLA
    { course_id: courses.ucla['CS31'],     professor_id: p['smallberg'],  semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS32'],     professor_id: p['smallberg'],  semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS33'],     professor_id: p['nachenberg'], semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS35L'],    professor_id: p['eggert'],     semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS111'],    professor_id: p['millstein'],  semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS130'],    professor_id: p['palsberg'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS131'],    professor_id: p['millstein'],  semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS132'],    professor_id: p['palsberg'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS143'],    professor_id: p['eggert'],     semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['CS161'],    professor_id: p['millstein'],  semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['MATH31A'],  professor_id: p['bertozzi'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['MATH31B'],  professor_id: p['vese'],       semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['MATH32A'],  professor_id: p['bertozzi'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['MATH33A'],  professor_id: p['vese'],       semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['MATH115A'], professor_id: p['bertozzi'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['ECON1'],    professor_id: p['burstein'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['ECON11'],   professor_id: p['burstein'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['ECON101'],  professor_id: p['burstein'],   semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['PSYCH100A'],professor_id: p['castel'],     semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.ucla['PSYCH100B'],professor_id: p['bjork'],      semester: 'Spring', year: 2026, is_current: true },
    // Berkeley
    { course_id: courses.berk['CS61A'],    professor_id: p['denero'],     semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['CS61B'],    professor_id: p['hug'],        semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['CS70'],     professor_id: p['rao'],        semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['CS189'],    professor_id: p['rao'],        semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['CS188'],    professor_id: p['denero'],     semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['MATH1A'],   professor_id: p['rao'],        semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['MATH54'],   professor_id: p['rao'],        semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['MATH110'],  professor_id: p['rao'],        semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['ECON1B'],   professor_id: p['denero'],     semester: 'Spring', year: 2026, is_current: true },
    { course_id: courses.berk['DATA8'],    professor_id: p['hug'],        semester: 'Spring', year: 2026, is_current: true },
  ]

  const { error } = await supabase.from('course_offerings').upsert(rows, {
    onConflict: 'course_id,professor_id,semester,year',
    ignoreDuplicates: true,
  })
  if (error) throw error

  // Fetch back all Spring 2026 offerings; cross-reference with course maps to
  // build code -> offering_id maps.
  const { data, error: selErr } = await supabase
    .from('course_offerings')
    .select('id, course_id')
    .eq('semester', 'Spring')
    .eq('year', 2026)
  if (selErr) throw selErr

  const courseToOffering: Record<string, string> = {}
  for (const o of data ?? []) courseToOffering[o.course_id] = o.id

  const ucla: Record<string, string> = {}
  const berk: Record<string, string> = {}
  for (const [code, courseId] of Object.entries(courses.ucla)) {
    if (courseToOffering[courseId]) ucla[code] = courseToOffering[courseId]
  }
  for (const [code, courseId] of Object.entries(courses.berk)) {
    if (courseToOffering[courseId]) berk[code] = courseToOffering[courseId]
  }
  console.log(`  offerings: ${Object.keys(ucla).length} UCLA + ${Object.keys(berk).length} Berkeley`)
  return { ucla, berk }
}

// ---------------------------------------------------------------------------
// 5. Users
// ---------------------------------------------------------------------------

function buildUsers(): SeedUser[] {
  const csPool    = ['CS131', 'CS111', 'CS32', 'CS33', 'CS161', 'CS35L', 'CS130', 'CS143']
  const mathPool  = ['MATH31A', 'MATH31B', 'MATH33A', 'MATH115A']
  const otherPool = ['ECON1', 'ECON11', 'PSYCH100A', 'PSYCH100B']

  const users: SeedUser[] = []

  for (let i = 1; i <= 15; i++) {
    const pool = i <= 8 ? csPool : i <= 12 ? mathPool : otherPool
    users.push({
      email: `tutor${String(i).padStart(3, '0')}@ucla.edu`,
      name:  faker.person.fullName(),
      major: pick(MAJORS),
      school: 'UCLA',
      isTutor: true,
      tutorCourseCodes: pickN(pool, randInt(2, 3)),
      gradYear: randInt(2025, 2027),
    })
  }

  for (let i = 1; i <= 20; i++) {
    users.push({
      email: `student${String(i).padStart(3, '0')}@ucla.edu`,
      name:  faker.person.fullName(),
      major: pick(MAJORS),
      school: 'UCLA',
      isTutor: false,
      tutorCourseCodes: [],
      gradYear: randInt(2025, 2028),
    })
  }

  for (let i = 1; i <= 15; i++) {
    users.push({
      email: `student${String(i).padStart(3, '0')}@berkeley.edu`,
      name:  faker.person.fullName(),
      major: pick(MAJORS),
      school: 'Berkeley',
      isTutor: false,
      tutorCourseCodes: [],
      gradYear: randInt(2025, 2028),
    })
  }

  return users
}

async function seedUsers(uclaId: string, berkId: string) {
  console.log('\n[5/11] Users (50 accounts)')
  const list = buildUsers()
  const created: Array<SeedUser & { id: string }> = []

  for (const u of list) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      email_confirm: true,
      user_metadata: { display_name: u.name },
    })

    let uid: string | null = null

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        let page = 1
        outer: while (true) {
          const { data: pg } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
          if (!pg?.users?.length) break
          for (const eu of pg.users) {
            if (eu.email === u.email) { uid = eu.id; break outer }
          }
          if (pg.users.length < 100) break
          page++
        }
      } else {
        console.warn(`  skip ${u.email}: ${error.message}`)
        continue
      }
    } else {
      uid = data.user?.id ?? null
    }

    if (!uid) continue

    await supabase.from('profiles').update({
      display_name:       u.name,
      major:              u.major,
      graduation_year:    u.gradYear,
      reputation_points:  u.isTutor ? randInt(400, 2200) : randInt(0, 250),
      school_id:          u.school === 'UCLA' ? uclaId : berkId,
      onboarding_complete: true,
    }).eq('id', uid)

    created.push({ ...u, id: uid })
  }

  console.log(`  users: ${created.length}`)
  return created
}

// ---------------------------------------------------------------------------
// 6. Enrollments
// ---------------------------------------------------------------------------

async function seedEnrollments(
  users: Array<SeedUser & { id: string }>,
  offerings: OfferingMap
) {
  console.log('\n[6/11] Enrollments')

  const uclaPool = Object.values(offerings.ucla)
  const berkPool = Object.values(offerings.berk)
  const rows: { user_id: string; offering_id: string }[] = []
  const seen = new Set<string>()

  for (const u of users) {
    const pool   = u.school === 'UCLA' ? uclaPool : berkPool
    const chosen = pickN(pool, randInt(2, 5))

    if (u.isTutor) {
      for (const code of u.tutorCourseCodes) {
        const oid = offerings.ucla[code]
        if (oid && !chosen.includes(oid)) chosen.push(oid)
      }
    }

    for (const oid of chosen) {
      const key = `${u.id}:${oid}`
      if (!seen.has(key)) { seen.add(key); rows.push({ user_id: u.id, offering_id: oid }) }
    }
  }

  await batchUpsert('enrollments', rows, 'user_id,offering_id', 'enrollments')
}

// ---------------------------------------------------------------------------
// 7. Verified tutors
// ---------------------------------------------------------------------------

async function seedVerifiedTutors(
  users: Array<SeedUser & { id: string }>,
  courses: CourseMap
) {
  console.log('\n[7/11] Verified tutors')
  const grades = ['A', 'A', 'A', 'A-', 'B+']
  const rows: { user_id: string; course_id: string; grade_earned: string }[] = []

  for (const u of users) {
    if (!u.isTutor) continue
    for (const code of u.tutorCourseCodes) {
      const cid = courses.ucla[code]
      if (cid) rows.push({ user_id: u.id, course_id: cid, grade_earned: pick(grades) })
    }
  }

  await batchUpsert('verified_tutors', rows, 'user_id,course_id', 'verified_tutors')
}

// ---------------------------------------------------------------------------
// 8. Questions + Answers + Likes
// ---------------------------------------------------------------------------

async function seedQuestionsAndAnswers(
  users: Array<SeedUser & { id: string }>,
  offerings: OfferingMap,
  courses: CourseMap,
  uclaId: string,
  berkId: string
) {
  console.log('\n[8/11] Questions, answers, likes')

  const { count: existingQ } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
  if (existingQ && existingQ > 0) {
    console.log(`  questions: ${existingQ} already exist, skipping`)
    return
  }

  // course_id -> department for topic generation
  const { data: courseRows } = await supabase.from('courses').select('id, department')
  const depts: Record<string, string | null> = {}
  for (const c of courseRows ?? []) depts[c.id] = c.department

  const uclaUsers       = users.filter((u) => u.school === 'UCLA')
  const berkUsers       = users.filter((u) => u.school === 'Berkeley')
  const uclaOfferingCodes = Object.keys(offerings.ucla)
  const berkOfferingCodes = Object.keys(offerings.berk)

  const qRows: object[] = []

  for (let i = 0; i < 60; i++) {
    const author     = pick(uclaUsers)
    const code       = pick(uclaOfferingCodes)
    const offeringId = offerings.ucla[code]
    const courseId   = courses.ucla[code]
    qRows.push({
      author_id:  author.id,
      offering_id: offeringId,
      school_id:  uclaId,
      ...buildQ(depts[courseId] ?? null),
      created_at: faker.date.recent({ days: 30 }).toISOString(),
    })
  }

  for (let i = 0; i < 20; i++) {
    const author     = pick(berkUsers)
    const code       = pick(berkOfferingCodes)
    const offeringId = offerings.berk[code]
    const courseId   = courses.berk[code]
    qRows.push({
      author_id:  author.id,
      offering_id: offeringId,
      school_id:  berkId,
      ...buildQ(depts[courseId] ?? null),
      created_at: faker.date.recent({ days: 30 }).toISOString(),
    })
  }

  const { data: qs, error: qErr } = await supabase.from('questions').insert(qRows).select('id')
  if (qErr) throw qErr
  console.log(`  questions: ${qRows.length}`)

  const aRows: object[] = []
  for (const q of qs ?? []) {
    for (let i = 0; i < randInt(2, 5); i++) {
      aRows.push({
        question_id: q.id,
        author_id:   pick(users).id,
        body:        pick(ANSWER_BODIES),
        created_at:  faker.date.recent({ days: 29 }).toISOString(),
      })
    }
  }

  const allAnswers: { id: string }[] = []
  const BATCH = 100
  for (let i = 0; i < aRows.length; i += BATCH) {
    const { data, error } = await supabase.from('answers').insert(aRows.slice(i, i + BATCH)).select('id')
    if (error) throw error
    if (data) allAnswers.push(...data)
  }
  console.log(`  answers: ${aRows.length}`)

  const likeRows: { answer_id: string; user_id: string }[] = []
  const seen = new Set<string>()
  for (const a of allAnswers) {
    for (const l of pickN(users, randInt(0, 7))) {
      const key = `${a.id}:${l.id}`
      if (!seen.has(key)) { seen.add(key); likeRows.push({ answer_id: a.id, user_id: l.id }) }
    }
  }
  await batchUpsert('answer_likes', likeRows, 'answer_id,user_id', 'answer_likes')
}

// ---------------------------------------------------------------------------
// 9. Professor ratings
// ---------------------------------------------------------------------------

async function seedProfRatings(
  users: Array<SeedUser & { id: string }>,
  profs: Record<string, string>,
  offerings: OfferingMap
) {
  console.log('\n[9/11] Professor ratings')

  const uclaUsers       = users.filter((u) => u.school === 'UCLA')
  const uclaOfferingIds = Object.values(offerings.ucla)
  const uclaProfs       = [
    'millstein', 'palsberg', 'eggert', 'smallberg', 'nachenberg',
    'bertozzi',  'vese',     'castel', 'bjork',     'burstein',
  ].map((k) => profs[k]).filter(Boolean)

  const rows: object[] = []
  const seen = new Set<string>()

  for (const profId of uclaProfs) {
    const raters     = pickN(uclaUsers, randInt(8, 15))
    const offeringId = pick(uclaOfferingIds)
    for (const rater of raters) {
      const key = `${profId}:${rater.id}:${offeringId}`
      if (seen.has(key)) continue
      seen.add(key)
      const base = randInt(2, 4)
      rows.push({
        professor_id:       profId,
        rater_id:           rater.id,
        offering_id:        offeringId,
        exam_fairness:      Math.min(5, base + randInt(0, 1)),
        grade_transparency: Math.min(5, base + randInt(0, 1)),
        lecture_quality:    Math.min(5, base + randInt(0, 1)),
        office_hours_value: Math.min(5, base + randInt(0, 1)),
        curve_likelihood:   Math.min(5, base + randInt(0, 1)),
        curve_magnitude:    Math.min(5, base + randInt(0, 1)),
        workload_realism:   Math.min(5, Math.max(1, base + randInt(-1, 1))),
        would_retake:       Math.random() > 0.3,
        grade_received:     pick(['A', 'A-', 'B+', 'B', 'C+']),
        comment:            Math.random() > 0.4 ? pick(PROF_RATING_COMMENTS) : null,
      })
    }
  }

  await batchUpsert('professor_ratings', rows, 'professor_id,rater_id,offering_id', 'professor_ratings')
}

// ---------------------------------------------------------------------------
// 10. Sessions
//
// UCLA: 8 open requests + 10 matched requests -> 10 sessions
// Berk: 4 open requests (no Berkeley tutors -> no matched sessions)
//
// tutor001 and tutor002 (users[0] and users[1]) are pinned as tutors for
// the first four sessions so a dev-login as either always shows sessions.
//
// All open requests use created_at within the last 1-3 days so they show as
// recent, not expired. Matched requests use 1-3 days as well.
// ---------------------------------------------------------------------------

const SESSION_DESCRIPTIONS_BY_CODE: Record<string, string[]> = {
  CS31:     ['Stuck on the linked list homework. My insert function passes most tests but crashes on the empty list edge case.', 'Need help understanding pointers before the midterm. The concepts make sense but I keep getting segfaults.'],
  CS32:     ['My BST implementation keeps corrupting memory on delete. Need someone who has done this assignment to help me debug.', 'Cannot figure out when to use a hash map versus a tree for the project. Need a session on the trade-offs.'],
  CS33:     ['Assembly is not clicking at all. Need help translating C functions to x86 for the midterm.', 'Stuck on virtual memory and page tables. The TLB section flew by in lecture and it will be on the exam.'],
  CS35L:    ['My shell script pipeline keeps breaking on files with spaces in the name. Need help debugging before the lab is due.', 'The Git merge conflict on our team project is a disaster. Need someone experienced to help me untangle the history.'],
  CS111:    ['My page fault handler keeps causing a kernel panic. Need someone who has finished this assignment to help me find the bug.', 'Cannot figure out the difference between semaphores and monitors before the exam. The TA explanation was circular.'],
  CS130:    ['Trying to decide which design pattern to use for the project. The options all seem applicable and I am overthinking it.', 'My team is stuck on the architecture decision. Need an outside perspective before we start building.'],
  CS131:    ['Stuck on the LL(1) parsing homework due Friday. Cannot figure out how to eliminate left recursion from the grammar.', 'Lambda calculus problems are not clicking. I can follow the steps but cannot apply beta reduction under exam pressure.', 'Need to understand dynamic versus static scoping with concrete examples before the midterm.'],
  CS132:    ['My NFA to DFA conversion keeps producing extra states. Need help with the subset construction algorithm.', 'My recursive descent parser does not handle all the grammar cases correctly. Need help finding the missing cases.'],
  CS143:    ['My semantic analysis pass is not catching all type errors. Looking for someone who finished the compiler project.', 'Need help understanding intermediate representations before the final. SSA form is not clicking.'],
  CS161:    ['Cannot explain the difference between A* and UCS in a way that would satisfy the exam. Need help with the intuition.', 'Bayesian network variable elimination is taking me too long on the homework. Need someone to walk through it with me.'],
  MATH31A:  ['Stuck on epsilon-delta proofs. I understand the definition but cannot construct a proof from scratch.', 'Related rates problems are taking three times longer than they should. Need a session on the method.'],
  MATH31B:  ['Cannot tell when to use the integral test versus the comparison test. Keep picking the wrong one on homework.', 'Taylor series convergence is not clicking. I can compute them mechanically but cannot explain the radius of convergence.'],
  MATH32A:  ['Multivariable chain rule is confusing me. The Jacobian formulation is different from single variable and I am getting lost.', 'Stuck on the surface integral parameterization step. That is where I keep going wrong.'],
  MATH33A:  ['Cannot figure out when a set of vectors is linearly independent. Need worked examples before the midterm.', 'Eigenvalue decomposition is taking me too long. Looking for a faster method or a pattern I am missing.'],
  MATH115A: ['The proof that the dual space has the same dimension is not clicking. Need an explanation from the definitions.', 'Change of basis problems keep confusing me. I mix up the direction the matrix is applied.'],
  ECON1:    ['Keep getting the direction of supply and demand shifts wrong on the homework. Need someone to drill this with me.', 'Elasticity problems are confusing me. The formula is fine but I cannot interpret the sign and magnitude correctly.'],
  ECON11:   ['Utility maximization setup is fine but I cannot solve the Lagrangian. Need help with the algebra.', 'Nash equilibrium problems are taking too long. Need help spotting the right strategy profile faster.'],
  ECON101:  ['Need help with the ECON101 final, specifically consumer and producer surplus problems under a price ceiling.', 'General equilibrium homework is much harder than intermediate micro. Need help setting up the excess demand system.', 'Mechanism design problems are not clicking. The incentive compatibility constraints are confusing me.'],
  PSYCH100A:['Cannot figure out which statistical test to use on the homework. The decision tree from lecture is too abstract.', 'Stuck on interpreting interaction effects in the ANOVA table. I understand the computation but not the meaning.'],
  PSYCH100B:['Cannot articulate the difference between internal and external validity for the exam. Need concrete examples.', 'Struggling to design a valid within-subjects study. Not sure how to handle order effects.'],
  CS61A:    ['My recursive function for the tree lab hits the base case wrong. Need help understanding the invariant.', 'Cannot figure out how to use higher-order functions correctly in the scheme section.'],
  CS61B:    ['My red-black tree insertion is breaking on recoloring. Need someone who passed the class to help me debug.', 'Cannot figure out why my hash function is creating too many collisions on the project test cases.'],
  CS70:     ['Modular arithmetic proofs are not clicking. I can verify the result but cannot construct the proof.', 'Keep getting the direction of conditional probability backwards. Need a session with worked examples.'],
  CS189:    ['Cannot figure out when to use L1 versus L2 regularization for the homework. Need help with the application.', 'My gradient descent is converging to the wrong minimum. Need help finding the bug in my update rule.'],
  CS188:    ['Need help with alpha-beta pruning before the midterm. The search part is fine but the pruning is not clicking.', 'Bayesian network inference homework is taking forever. Cannot figure out how to use d-separation correctly.'],
  MATH1A:   ['Need help with limits using L\'Hopital\'s rule. Know when to use it but making algebraic errors.', 'Struggling with integration by substitution from this week\'s homework.'],
  MATH54:   ['Method of undetermined coefficients is not clicking for the ODE section.', 'My eigenvalue computation keeps going wrong on 3x3 matrices. Need to find the arithmetic error.'],
  MATH110:  ['The proof that every linear map has a matrix representation is not making sense.', 'Stuck on the Jordan normal form algorithm. The textbook explanation is too dense.'],
  ECON1B:   ['Keep getting the opportunity cost direction wrong on production possibilities problems.', 'Comparative advantage questions are tripping me up. The concept makes sense but the application does not.'],
  DATA8:    ['My data cleaning function is dropping rows I need to keep. Cannot find the bug in the filter condition.', 'Cannot figure out when to use a t-test versus a permutation test on the homework.'],
}

const SESSION_DESCRIPTIONS_GENERIC = [
  'Stuck on the assignment and cannot crack the right approach. Need someone to walk me through it before the deadline.',
  'The material from the last two lectures is not clicking. Looking for a patient tutor who can explain it differently.',
  'Midterm is coming up and I need to go through the practice problems with someone who knows the course well.',
  'Office hours are always full. Need a dedicated session to get caught up before the deadline.',
  'My approach seems correct but my answers keep coming out wrong. Want someone to check my reasoning.',
  'First time taking a course at this level. Falling behind and need a reset session to rebuild confidence.',
  'The TA explained it but it made it worse. Looking for someone who has been through this course and has the real mental model.',
]

async function seedSessions(
  users: Array<SeedUser & { id: string }>,
  offerings: OfferingMap,
  uclaId: string,
  berkId: string
) {
  console.log('\n[10/11] Sessions')

  // Always delete and re-seed so stale descriptions and old timestamps never survive.
  console.log('  deleting stale session_participants, sessions, session_requests...')
  const { error: delP } = await supabase.from('session_participants').delete().neq('session_id', '00000000-0000-0000-0000-000000000000')
  if (delP) console.error('  delete session_participants error:', delP.message)
  const { error: delS } = await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delS) console.error('  delete sessions error:', delS.message)
  const { error: delR } = await supabase.from('session_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delR) console.error('  delete session_requests error:', delR.message)
  console.log('  deleted.')

  const uclaStudents    = users.filter((u) => u.school === 'UCLA' && !u.isTutor)
  const berkStudents    = users.filter((u) => u.school === 'Berkeley')
  const uclaTutors      = users.filter((u) => u.school === 'UCLA' && u.isTutor)
  if (!uclaStudents.length || !uclaTutors.length) return

  const uclaOfferingIds = Object.values(offerings.ucla)
  const berkOfferingIds = Object.values(offerings.berk)

  // Reverse maps: offeringId -> courseCode, for description generation
  const uclaOidToCode: Record<string, string> = {}
  const berkOidToCode: Record<string, string> = {}
  for (const [code, oid] of Object.entries(offerings.ucla)) uclaOidToCode[oid] = code
  for (const [code, oid] of Object.entries(offerings.berk)) berkOidToCode[oid] = code

  function descFor(oid: string, reverseMap: Record<string, string>): string {
    const code = reverseMap[oid] ?? ''
    const pool = SESSION_DESCRIPTIONS_BY_CODE[code]
    return pool?.length ? pick(pool) : pick(SESSION_DESCRIPTIONS_GENERIC)
  }

  const reqRows: object[] = []

  // UCLA - 8 open requests (varied types, durations, prices)
  // created_at within last 1-3 days so they show as recent.
  const uclaOpenConfigs = [
    { session_type: 'emergency', duration_minutes: 45,  format: '1on1',  max_students: 1, price_display: 25, expires_hours: 2 },
    { session_type: 'emergency', duration_minutes: 60,  format: '1on1',  max_students: 1, price_display: 20, expires_hours: 3 },
    { session_type: 'scheduled', duration_minutes: 60,  format: '1on1',  max_students: 1, price_display: 20, expires_hours: null },
    { session_type: 'scheduled', duration_minutes: 60,  format: '1on1',  max_students: 1, price_display: 15, expires_hours: null },
    { session_type: 'scheduled', duration_minutes: 90,  format: '1on1',  max_students: 1, price_display: 0,  expires_hours: null },
    { session_type: 'scheduled', duration_minutes: 60,  format: '1on1',  max_students: 1, price_display: 20, expires_hours: null },
    { session_type: 'scheduled', duration_minutes: 90,  format: 'group', max_students: 4, price_display: 10, expires_hours: null },
    { session_type: 'scheduled', duration_minutes: 120, format: 'group', max_students: 6, price_display: 8,  expires_hours: null },
  ]
  for (let i = 0; i < uclaOpenConfigs.length; i++) {
    const cfg        = uclaOpenConfigs[i]
    const offeringId = pick(uclaOfferingIds)
    reqRows.push({
      student_id:       pick(uclaStudents).id,
      offering_id:      offeringId,
      school_id:        uclaId,
      description:      descFor(offeringId, uclaOidToCode),
      session_type:     cfg.session_type,
      duration_minutes: cfg.duration_minutes,
      format:           cfg.format,
      max_students:     cfg.max_students,
      price_display:    cfg.price_display,
      status:           'open',
      expires_at:       cfg.expires_hours
        ? new Date(Date.now() + cfg.expires_hours * 3_600_000).toISOString()
        : null,
      created_at: faker.date.recent({ days: 2 }).toISOString(),
    })
  }

  // UCLA - 10 matched requests -> will become sessions
  // created_at within last 1-3 days so the feed does not show old relative timestamps.
  for (let i = 0; i < 10; i++) {
    const offeringId = pick(uclaOfferingIds)
    reqRows.push({
      student_id:       pick(uclaStudents).id,
      offering_id:      offeringId,
      school_id:        uclaId,
      description:      descFor(offeringId, uclaOidToCode),
      session_type:     i < 3 ? 'emergency' : 'scheduled',
      duration_minutes: pick([45, 60, 60, 90]),
      format:           i < 9 ? '1on1' : 'group',
      max_students:     i < 9 ? 1 : 4,
      price_display:    pick([0, 15, 20, 20, 25]),
      status:           'matched',
      expires_at:       null,
      created_at:       faker.date.recent({ days: 3 }).toISOString(),
    })
  }

  // Berkeley - 4 open requests (no tutors seeded, so all stay open)
  for (let i = 0; i < 4; i++) {
    const offeringId = pick(berkOfferingIds)
    reqRows.push({
      student_id:       pick(berkStudents).id,
      offering_id:      offeringId,
      school_id:        berkId,
      description:      descFor(offeringId, berkOidToCode),
      session_type:     i === 0 ? 'emergency' : 'scheduled',
      duration_minutes: pick([60, 90]),
      format:           '1on1',
      max_students:     1,
      price_display:    pick([0, 20, 25]),
      status:           'open',
      expires_at:       i === 0 ? new Date(Date.now() + 3_600_000).toISOString() : null,
      created_at:       faker.date.recent({ days: 2 }).toISOString(),
    })
  }

  const { data: reqs, error: rErr } = await supabase
    .from('session_requests')
    .insert(reqRows)
    .select('id, student_id, offering_id, duration_minutes, format, max_students, price_display, status')
  if (rErr) throw rErr

  const matched = (reqs ?? []).filter((r) => r.status === 'matched')
  if (!matched.length) {
    console.log(`  session_requests: ${reqRows.length} (no matched -> no sessions)`)
    return
  }

  // Pin tutor001 (users[0]) and tutor002 (users[1]) to the first four sessions
  // so those dev-login accounts always have visible sessions.
  const pinned = uclaTutors.slice(0, 2)
  const tutorFor = (i: number) => {
    if (i < 2) return pinned[0]
    if (i < 4) return pinned[1]
    return pick(uclaTutors)
  }

  const PREP_NOTES = [
    'Review the lecture slides from weeks 4 and 5 before the session.',
    'Bring your specific failing test cases so we can debug together.',
    'Try the practice problems first; we will go over what you could not solve.',
    'No prep needed, we will start from the beginning and build up.',
  ]

  const sessRows = matched.map((r, i) => {
    const daysOffset = randInt(0, 12)
    const isCompleted = daysOffset > 3
    return {
      request_id:                r.id,
      tutor_id:                  tutorFor(i).id,
      offering_id:               r.offering_id,
      format:                    r.format,
      max_students:              r.max_students,
      status:                    isCompleted ? 'completed' : 'scheduled',
      scheduled_at:              isCompleted
        ? faker.date.recent({ days: daysOffset }).toISOString()
        : faker.date.soon({ days: randInt(1, 7) }).toISOString(),
      duration_minutes:          r.duration_minutes,
      price_per_student_display: r.price_display,
      meet_url: Math.random() > 0.15
        ? 'https://meet.google.com/abc-defg-hij'
        : null,
      prep_note: Math.random() > 0.5
        ? pick(PREP_NOTES)
        : null,
    }
  })

  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .insert(sessRows)
    .select('id')
  if (sErr) throw sErr

  const partRows = matched
    .map((r, i) => ({
      session_id:     (sessions ?? [])[i]?.id,
      student_id:     r.student_id,
      payment_status: 'simulated',
    }))
    .filter((p) => p.session_id)

  if (partRows.length) {
    await batchUpsert('session_participants', partRows, 'session_id,student_id', 'session_participants')
  }

  const openCount = (reqRows as any[]).filter((r) => r.status === 'open').length
  const scheduled = sessRows.filter((s) => s.status === 'scheduled').length
  const completed = sessRows.filter((s) => s.status === 'completed').length
  console.log(`  session_requests: ${reqRows.length} (${openCount} open, ${matched.length} matched)`)
  console.log(`  sessions: ${sessRows.length} (${scheduled} scheduled, ${completed} completed)`)
}

// ---------------------------------------------------------------------------
// 11. Study groups
// ---------------------------------------------------------------------------

async function seedStudyGroups(
  users: Array<SeedUser & { id: string }>,
  offerings: OfferingMap
) {
  console.log('\n[11/11] Study groups')

  const { count: existingSG } = await supabase
    .from('study_groups')
    .select('*', { count: 'exact', head: true })
  if (existingSG && existingSG > 0) {
    console.log(`  study_groups: ${existingSG} already exist, skipping`)
    return
  }

  const uclaUsers       = users.filter((u) => u.school === 'UCLA')
  const uclaOfferingIds = Object.values(offerings.ucla)

  const groupRows = Array.from({ length: 5 }, () => ({
    offering_id: pick(uclaOfferingIds),
    creator_id:  pick(uclaUsers).id,
    name:        `${faker.word.adjective()} ${faker.word.noun()} Study Group`,
    description: pick(STUDY_GROUP_DESCRIPTIONS),
    max_members: 8,
    is_private:  Math.random() > 0.7,
  }))

  const { data: groups, error: gErr } = await supabase
    .from('study_groups')
    .insert(groupRows)
    .select('id, creator_id')
  if (gErr) throw gErr

  const memberRows: object[] = []
  const seen = new Set<string>()

  for (const g of groups ?? []) {
    memberRows.push({ group_id: g.id, user_id: g.creator_id, role: 'admin' })
    seen.add(`${g.id}:${g.creator_id}`)
    for (const u of pickN(uclaUsers, randInt(2, 4))) {
      const key = `${g.id}:${u.id}`
      if (!seen.has(key)) { seen.add(key); memberRows.push({ group_id: g.id, user_id: u.id, role: 'member' }) }
    }
  }

  await batchUpsert('study_group_members', memberRows, 'group_id,user_id', 'study_group_members')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Campus seed starting...')
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
    process.exit(1)
  }

  const { uclaId, berkId } = await seedSchools()
  const profs               = await seedProfessors(uclaId, berkId)
  const courses             = await seedCourses(uclaId, berkId)
  const offerings           = await seedOfferings(courses, profs)

  const users = await seedUsers(uclaId, berkId)
  if (!users.length) {
    console.error('No users seeded - verify your Supabase project and service role key')
    process.exit(1)
  }

  await seedEnrollments(users, offerings)
  await seedVerifiedTutors(users, courses)
  await seedQuestionsAndAnswers(users, offerings, courses, uclaId, berkId)
  await seedProfRatings(users, profs, offerings)
  await seedSessions(users, offerings, uclaId, berkId)
  await seedStudyGroups(users, offerings)

  // Confirm no Latin survived: print first 3 session_request descriptions.
  const { data: sample } = await supabase
    .from('session_requests')
    .select('description')
    .order('created_at', { ascending: false })
    .limit(3)
  console.log('\nFirst 3 session_request descriptions:')
  for (const row of sample ?? []) {
    console.log(' -', row.description)
  }

  console.log('\nSeed complete!')
  console.log('Seeded accounts: tutor001-015@ucla.edu, student001-020@ucla.edu, student001-015@berkeley.edu')
  console.log('Use dev login to sign in directly without email.')
}

main().catch((err) => {
  console.error('\nSeed failed:', err)
  process.exit(1)
})
