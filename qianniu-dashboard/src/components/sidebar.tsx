"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  MessageSquare,
  Monitor,
  Settings,
  Shield,
  TrendingUp,
  Wifi,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navigation = [
  {
    name: "实时监控",
    href: "/",
    icon: Monitor,
    description: "实时监控客服状态",
  },
  {
    name: "消息管理",
    href: "/messages",
    icon: MessageSquare,
    description: "管理客服消息",
  },
  {
    name: "规则配置",
    href: "/rules",
    icon: Shield,
    description: "配置自动化规则",
  },
  {
    name: "数据分析",
    href: "/analytics",
    icon: BarChart3,
    description: "查看数据分析",
  },
  {
    name: "WebSocket演示",
    href: "/websocket-demo",
    icon: Wifi,
    description: "WebSocket连接管理演示",
  },
  {
    name: "系统设置",
    href: "/settings",
    icon: Settings,
    description: "系统配置设置",
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn("pb-12 min-h-screen", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center mb-6">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h2 className="ml-2 text-lg font-semibold tracking-tight">
              千牛客服
            </h2>
          </div>
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Button
                  key={item.name}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive && "bg-muted font-medium"
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}