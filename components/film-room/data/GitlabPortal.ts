import { Project } from "./project";

export const gitlabPortalProject: Project = {
  slug: 'gitlab-portal',
  title: 'GitLab Management Portal',
  tagline: 'Visual planning for epics, issues, and MRs at scale',
  description: `An internal tool built to transform GitLab group and project data into clear, actionable dashboards.
It helps engineering leads, PMs, and execs monitor epic progress, issue dependencies, and team velocity across milestones.`,
  coverImage: '/images/projects/gitlab-portal-cover.png',
  slides: [
    {
      type: 'text',
      heading: 'GitLab Management Portal',
      subtext: 'Built for internal planning, progress tracking, and executive visibility',
      content: `A high-level view of engineering execution across GitLab epics, issues, and merge requests.
Supports epic swimlanes, dependency trees, milestone rollups, and more — all via React + TypeScript.`
    },
    {
      type: 'image',
      heading: 'Epic Swimlanes + Dependency Trees',
      subtext: 'Visualize issue hierarchies and blocking relationships in one view',
      content: '/images/projects/gitlab-swimlane-tree.png'
    },
    {
      type: 'code',
      heading: 'Feature-based Architecture',
      subtext: 'Scalable React structure with MUI, hooks, and service layers',
      content: `src/
├── app/
├── features/
│   ├── epic/
│   ├── issue/
│   ├── milestone/
│   └── dashboard/
├── services/
├── hooks/
└── common/`
    },
    {
      type: 'quote',
      heading: 'Engineering Feedback',
      subtext: 'From internal stakeholders',
      content: `This made cross-team planning meetings so much smoother. I can see blockers, team loads, and progress at a glance.`
    }
  ]
}