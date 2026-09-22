import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel,
} from "./sidebar"

import { NavLink } from "react-router-dom"
import React from "react"


interface NavMainItem {
  title: string;
  url: string;
  icon?: React.ComponentType<unknown> | null;
  [key: string]: unknown;
}


interface NavMainProps {
  items: NavMainItem[];
  label?: string;
}

export function NavMain({ items, label }: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarGroupLabel className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] ml-2 mb-1">{label ?? "General"}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((item) => (
            <NavLink 
              to={item.url} 
              key={item.url}
              className={({isActive}) => 
                `block transition-all duration-300 ease-out ${isActive ? 'scale-[1.02]' : 'hover:translate-x-1.5'}`
              }
            >
              {({isActive}) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    tooltip={item.title} 
                    className={`transition-all duration-300 group rounded-xl px-3 py-2.5 ${isActive ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/10 text-cyan-400 border-l-2 border-cyan-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-primary/10 hover:text-primary text-foreground/80'}`}
                  >
                    <div className={`transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'group-hover:scale-110'}`}>
                      {item.icon ? React.createElement(item.icon) : null}
                    </div>
                    <span className={`font-medium ${isActive ? 'tracking-wide' : ''}`}>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </NavLink>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
