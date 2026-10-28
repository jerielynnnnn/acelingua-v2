"use client";
import Link from "next/link";
import { useState } from "react";
import { lessonHref } from "@/lib/admin/navigation";
export default function AdminLessonSelection({ lessons, slug, courses = [], units = [] }: {
  lessons: {
    id: string;
    title: string;
    unitId?: string;
  }[];
  courses?: {
    id: string;
    title: string;
  }[];
  units?: {
    id: string;
    title: string;
    courseId: string;
  }[];
  slug: string;
}) {
  const [course, setCourse] = useState("");
  const [unit, setUnit] = useState("");
  const visibleUnits = units.filter(item => !course || item.courseId === course);
  const visibleLessons = lessons.filter(item => (!unit || item.unitId === unit) && (!course || visibleUnits.some(parent => parent.id === item.unitId)));
  return <section className="rounded-2xl border border-[#C7A9D4]/40 bg-white p-6 text-[#2A255C]">
    <h1 className="text-2xl font-bold">Select a lesson</h1>
    <p className="my-3 text-sm text-slate-600">Choose a lesson to continue. An unavailable or invalid lesson is never replaced automatically.</p>
    {!!courses.length && <div className="my-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Course<select value={course} onChange={event => { setCourse(event.target.value); setUnit(""); }} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3">
        <option value="">All courses</option>
        {courses.map(item => <option key={item.id} value={item.id}>
          {item.title}
        </option>)}
      </select>
      </label>
      <label className="text-sm font-semibold">Unit<select value={unit} onChange={event => setUnit(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3">
        <option value="">All units</option>
        {visibleUnits.map(item => <option key={item.id} value={item.id}>
          {item.title}
        </option>)}
      </select>
      </label>
    </div>}
    {visibleLessons.length ? <ul className="grid gap-2 sm:grid-cols-2">
      {visibleLessons.map(lesson => {
        const parent = units.find(item => item.id === lesson.unitId);
        const courseTitle = courses.find(item => item.id === parent?.courseId)?.title;
        return <li key={lesson.id}>
          <Link className="block rounded-xl bg-[#f4f1ff] p-3 font-semibold text-[#3558AE] hover:underline" href={lessonHref(slug, lesson.id, { course: parent?.courseId, unit: parent?.id })}>
            {lesson.title}{parent && <span className="mt-1 block text-xs font-normal text-slate-600">
              {courseTitle} / {parent.title}
            </span>}
          </Link>
        </li>;
      })}
    </ul> : <p>No eligible lessons available. <Link className="text-[#3558AE] underline" href="/admin/curriculum/roadmap">Open the roadmap</Link> to create a lesson.</p>}
  </section>;
}
