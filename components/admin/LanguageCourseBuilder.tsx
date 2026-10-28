
import Link from "next/link";

import {
  BookOpen,
  ChevronDown,
  CircleCheck,
  Globe2,
  Languages,
  Plus,
} from "lucide-react";

import {
  saveCourseAction,
  saveLanguageAction,
  setCourseStatusAction,
  setLanguageActiveAction,
} from "@/lib/curriculum/builder-actions";

export type LanguageRow = {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  flag_emoji: string | null;
  is_active: boolean;
};

export type CourseRow = {
  id: string;
  language_id: string;
  title: string;
  description: string | null;
  difficulty: string;
  status: string;
};

type Props = {
  languages: LanguageRow[];
  courses: CourseRow[];
  selectedLanguage?: string;
  success?: string;
  error?: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#2A255C] outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/15";

const labelClass =
  "block space-y-2 text-sm font-semibold text-[#2A255C]";

const buttonClass =
  "rounded-xl bg-[#3558AE] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2A255C]";

const detailsClass =
  "group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

function LanguageForm({
  language,
}: {
  language?: LanguageRow;
}) {
  return (
    <form
      action={saveLanguageAction}
      className="mt-5 grid gap-4 md:grid-cols-2"
    >
      {language && (
        <input type="hidden" name="id" value={language.id} />
      )}

      <label className={labelClass}>
        Language Code *
        <input
          name="code"
          required
          maxLength={20}
          placeholder="ja"
          defaultValue={language?.code ?? ""}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Language Name *
        <input
          name="name"
          required
          maxLength={100}
          placeholder="Japanese"
          defaultValue={language?.name ?? ""}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Native Name
        <input
          name="native_name"
          maxLength={100}
          placeholder="日本語"
          defaultValue={language?.native_name ?? ""}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Flag Emoji
        <input
          name="flag_emoji"
          maxLength={20}
          placeholder="🇯🇵"
          defaultValue={language?.flag_emoji ?? ""}
          className={inputClass}
        />
      </label>

      <div className="md:col-span-2">
        <button type="submit" className={buttonClass}>
          {language ? "Save Language" : "Create Language"}
        </button>
      </div>
    </form>
  );
}

function CourseForm({
  languages,
  course,
  defaultLanguage,
}: {
  languages: LanguageRow[];
  course?: CourseRow;
  defaultLanguage?: string;
}) {
  return (
    <form
      action={saveCourseAction}
      className="mt-5 grid gap-4 md:grid-cols-2"
    >
      {course && (
        <input type="hidden" name="id" value={course.id} />
      )}

      <label className={labelClass}>
        Language *
        <select
          name="language_id"
          required
          defaultValue={
            course?.language_id ?? defaultLanguage ?? ""
          }
          className={inputClass}
        >
          <option value="">Select a language</option>

          {languages.map((language) => (
            <option key={language.id} value={language.id}>
              {language.flag_emoji || "🌐"} {language.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Difficulty *
        <select
          name="difficulty"
          required
          defaultValue={course?.difficulty ?? "beginner"}
          className={inputClass}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>

      <label className={`${labelClass} md:col-span-2`}>
        Course Title *
        <input
          name="title"
          required
          maxLength={150}
          placeholder="Japanese Beginner"
          defaultValue={course?.title ?? ""}
          className={inputClass}
        />
      </label>

      <label className={`${labelClass} md:col-span-2`}>
        Course Description
        <textarea
          name="description"
          rows={4}
          maxLength={3000}
          placeholder="Learn greetings, vocabulary, and everyday Japanese conversation."
          defaultValue={course?.description ?? ""}
          className={`${inputClass} resize-y`}
        />
      </label>

      <div className="md:col-span-2">
        <button type="submit" className={buttonClass}>
          {course ? "Save Course" : "Create Draft Course"}
        </button>
      </div>
    </form>
  );
}

function CourseStatusForm({
  course,
  status,
  label,
}: {
  course: CourseRow;
  status: "draft" | "published" | "archived";
  label: string;
}) {
  return (
    <form action={setCourseStatusAction}>
      <input type="hidden" name="id" value={course.id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#3558AE] transition hover:bg-indigo-50"
      >
        {label}
      </button>
    </form>
  );
}

export default function LanguageCourseBuilder({
  languages,
  courses,
  selectedLanguage,
  success,
  error,
}: Props) {
  const activeCount = languages.filter(
    (language) => language.is_active
  ).length;

  const publishedCount = courses.filter(
    (course) => course.status === "published"
  ).length;

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      <div className="mx-auto max-w-6xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#3558AE]">
            <Languages size={17} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            Languages & Courses
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Organize the available languages and build the
            courses that will contain units, lessons, and
            interactive activities.
          </p>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Languages", value: languages.length },
            { label: "Active Languages", value: activeCount },
            { label: "Courses", value: courses.length },
            { label: "Published Courses", value: publishedCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm"
            >
              <p className="text-3xl font-extrabold">
                {item.value}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                {item.label}
              </p>
            </div>
          ))}
        </section>

        {success && (
          <div
            role="status"
            className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700"
          >
            <CircleCheck size={20} />
            {success}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        <section className="mt-10 space-y-4">
          <div className="flex items-center gap-3">
            <Globe2 className="text-[#3558AE]" />
            <h2 className="text-2xl font-extrabold">
              Language Management
            </h2>
          </div>

          <details
            className={detailsClass}
            open={languages.length === 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-bold">
                <Plus size={19} className="text-[#3558AE]" />
                Add New Language
              </span>

              <ChevronDown className="transition group-open:rotate-180" />
            </summary>

            <LanguageForm />
          </details>

          <div className="grid gap-4 md:grid-cols-2">
            {languages.map((language) => {
              const courseCount = courses.filter(
                (course) =>
                  course.language_id === language.id
              ).length;

              return (
                <article
                  key={language.id}
                  className="rounded-2xl border border-white bg-white/90 p-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#f1edff] text-4xl">
                      {language.flag_emoji || "🌐"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-extrabold">
                        {language.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {language.native_name || language.code}
                      </p>

                      <p className="mt-2 text-xs font-semibold text-[#3558AE]">
                        {courseCount} course(s)
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        language.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {language.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <form action={setLanguageActiveAction}>
                      <input
                        type="hidden"
                        name="id"
                        value={language.id}
                      />

                      <input
                        type="hidden"
                        name="active"
                        value={
                          language.is_active ? "false" : "true"
                        }
                      />

                      <button
                        type="submit"
                        className="rounded-xl bg-[#3558AE] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2A255C]"
                      >
                        {language.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </form>

                    <Link
                      href={`/admin/curriculum/builder?language=${language.id}#courses`}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#3558AE] hover:bg-indigo-50"
                    >
                      View Courses
                    </Link>
                  </div>

                  <details className="group mt-5 border-t border-slate-100 pt-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-[#3558AE]">
                      Edit Language
                      <ChevronDown
                        size={17}
                        className="transition group-open:rotate-180"
                      />
                    </summary>

                    <LanguageForm language={language} />
                  </details>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="courses"
          className="mt-12 scroll-mt-8 space-y-4"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="text-[#3558AE]" />
            <h2 className="text-2xl font-extrabold">
              Course Management
            </h2>
          </div>

          <details
            className={detailsClass}
            open={courses.length === 0 && languages.length > 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-bold">
                <Plus size={19} className="text-[#3558AE]" />
                Create New Course
              </span>

              <ChevronDown className="transition group-open:rotate-180" />
            </summary>

            {languages.length === 0 ? (
              <p className="mt-5 text-sm text-amber-700">
                Create a language before adding a course.
              </p>
            ) : (
              <CourseForm
                languages={languages}
                defaultLanguage={selectedLanguage}
              />
            )}
          </details>

          {languages.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/curriculum/builder#courses"
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#3558AE]"
              >
                All Languages
              </Link>

              {languages.map((language) => (
                <Link
                  key={language.id}
                  href={`/admin/curriculum/builder?language=${language.id}#courses`}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    selectedLanguage === language.id
                      ? "bg-[#3558AE] text-white"
                      : "bg-white text-[#3558AE]"
                  }`}
                >
                  {language.flag_emoji || "🌐"} {language.name}
                </Link>
              ))}
            </div>
          )}

          {courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
              <BookOpen
                size={38}
                className="mx-auto text-[#C7A9D4]"
              />

              <h3 className="mt-4 font-bold">
                No courses in this selection
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Create a draft course using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {courses.map((course) => {
                const language = languages.find(
                  (item) => item.id === course.language_id
                );

                return (
                  <article
                    key={course.id}
                    className="rounded-2xl border border-white bg-white/90 p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[#3558AE]">
                        {language?.flag_emoji || "🌐"}{" "}
                        {language?.name || "Unknown language"}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                          course.status === "published"
                            ? "bg-green-100 text-green-700"
                            : course.status === "archived"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {course.status}
                      </span>
                    </div>

                    <h3 className="mt-4 text-xl font-extrabold">
                      {course.title}
                    </h3>

                    <span className="mt-2 inline-block rounded-lg bg-[#f1edff] px-3 py-1 text-xs font-semibold capitalize text-[#3558AE]">
                      {course.difficulty}
                    </span>

                    <p className="mt-4 text-sm leading-relaxed text-slate-500">
                      {course.description ||
                        "No description provided."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {course.status !== "published" && (
                        <CourseStatusForm
                          course={course}
                          status="published"
                          label="Publish"
                        />
                      )}

                      {course.status === "published" && (
                        <CourseStatusForm
                          course={course}
                          status="draft"
                          label="Unpublish"
                        />
                      )}

                      {course.status !== "archived" && (
                        <CourseStatusForm
                          course={course}
                          status="archived"
                          label="Archive"
                        />
                      )}

                      {course.status === "archived" && (
                        <CourseStatusForm
                          course={course}
                          status="draft"
                          label="Restore Draft"
                        />
                      )}
                    </div>

                    <details className="group mt-5 border-t border-slate-100 pt-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-[#3558AE]">
                        Edit Course
                        <ChevronDown
                          size={17}
                          className="transition group-open:rotate-180"
                        />
                      </summary>

                      <CourseForm
                        languages={languages}
                        course={course}
                      />
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-10 rounded-2xl border border-[#ddd7f9] bg-white/80 p-5 text-sm text-slate-600">
          <strong className="text-[#2A255C]">
            Next: Units & Lessons.
          </strong>{" "}
          Each course will soon contain an expandable
          curriculum tree and its own learner roadmap.
          Imported and manually authored activities will
          connect to those lessons.
        </div>
      </div>
    </main>
  );
}
