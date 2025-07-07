'use client'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { LogoSvg } from '@/components/common/LogoSvg'
import { ProjectGallery } from '@/components/common/ProjectGallery'
import { CourtContainer } from '@/components/court/CourtContainer'
import { CourtSvg } from '@/components/court/CourtSvg'
import { CourtTitleSolo } from '@/components/court/CourtTitleSolo'
import { CourtZone } from '@/components/court/CourtZone'
import { ZoneBars } from '@/components/court/zones/ZoneBars'
import { ZoneBioCard } from '@/components/court/zones/ZoneBioCard'
import { ZoneCareerStats } from '@/components/court/zones/ZoneCareerStats'
import { ZoneFantasy } from '@/components/court/zones/ZoneFantasy'
import React from 'react'

export default function ProjectPage() {
  return (
    <ProjectGallery/>
  )
}
