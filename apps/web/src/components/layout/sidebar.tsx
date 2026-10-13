"use client"

import { useState, type CSSProperties } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ActivityIcon,
  KeySquareIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  UserRoundIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react"

import WLogo from "@/components/landing-page/header/w-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/api"

const NAV_ITEMS: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Home", href: "#", icon: LayoutDashboardIcon },
  { title: "Workflows", href: "#", icon: WorkflowIcon },
  { title: "Executions", href: "#", icon: ActivityIcon },
  { title: "Credentials", href: "#", icon: KeySquareIcon },
  { title: "Account", href: "#", icon: UserRoundIcon },
]

export const SIDEBAR_THEME = {
  "--sidebar": "#1a1a1a",
  "--sidebar-foreground": "#f5f5f5",
  "--sidebar-border": "rgba(255, 255, 255, 0.10)",
  "--sidebar-accent": "rgba(255, 255, 255, 0.08)",
  "--sidebar-accent-foreground": "#ffffff",
  "--sidebar-primary": "#F04D26",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-ring": "#F04D26",
  "--sidebar-width": "15.5rem",
  "--sidebar-width-icon": "2.5rem",
  "--background": "#151515",
} as CSSProperties

function CollapseTrigger({ className }: { className?: string }) {
  const { toggleSidebar, state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md transition-[color,background-color,transform] duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04D26]/50",
        isCollapsed
          ? "text-[#F04D26] hover:text-[#F04D26]"
          : "text-[var(--nav-text)] hover:text-white",
        className
      )}
    >
      {isCollapsed ? (
        <PanelLeftOpenIcon className="size-[18px]" />
      ) : (
        <PanelLeftCloseIcon className="size-[18px]" />
      )}
    </button>
  )
}

function UserAvatar({ user }: { user: User }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name}
        className="size-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    )
  }

  const initial =
    (user.name?.trim().charAt(0) || user.email?.charAt(0) || "U").toUpperCase()

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#F04D26]/15 text-[11px] font-semibold text-[#F04D26] ring-1 ring-inset ring-[#F04D26]/30">
      {initial}
    </span>
  )
}

interface AppSidebarProps {
  user: User
  onSignOut: () => void
}

export function AppSidebar({ user, onSignOut }: AppSidebarProps) {
  const [active, setActive] = useState<string>(NAV_ITEMS[0]?.title ?? "")

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="font-sans"
    >
      <SidebarHeader className="h-16 justify-center px-2 group-data-[collapsible=icon]:p-1!">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/"
            aria-label="WorkWeave home"
            className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90 group-data-[collapsible=icon]:hidden"
          >
            <WLogo className="size-8 shrink-0" />
            <span className="truncate font-display text-xl tracking-tight text-sidebar-foreground">
              Work<span className="font-medium text-[#a89fc0]">Weave</span>
            </span>
          </Link>
          <CollapseTrigger className="ml-auto group-data-[collapsible=icon]:ml-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:p-1!">
          <SidebarGroupLabel className="mb-3 text-[var(--nav-text)]">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = active === item.title
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={
                        <a
                          href={item.href}
                          onClick={(event) => {
                            event.preventDefault()
                            setActive(item.title)
                          }}
                        />
                      }
                      tooltip={item.title}
                      className={`relative h-10 transition-colors duration-200 ${
                        isActive
                          ? "text-white"
                          : "text-[var(--nav-text)] hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-md bg-[#313131]"
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 38,
                          }}
                        />
                      )}
                      <item.icon className="relative z-10 size-[18px]" />
                      <span className="relative z-10 truncate text-[15px] group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 group-data-[collapsible=icon]:p-1!">
        <div className="flex items-center gap-2 rounded-md py-1 transition-colors group-data-[collapsible=icon]:justify-center">
          <UserAvatar user={user} />
          <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[15px] font-medium text-sidebar-foreground">
              {user.name}
            </span>
            <span className="truncate text-xs text-[var(--nav-text)]">
              {user.email}
            </span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Log out"
            title="Log out"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--nav-text)] transition-colors hover:bg-white/10 hover:text-[#F04D26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04D26]/50 group-data-[collapsible=icon]:hidden"
          >
            <LogOutIcon className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar