/**
 * 千牛客服系统 - 规则配置页面组件
 * 
 * @description 规则配置页面，管理自动化回复规则和业务处理规则
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @updated 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 自动化规则管理
 * - 规则启用/禁用控制
 * - 规则触发统计
 * - 规则编辑和删除
 * - 新规则创建
 * 
 * 技术栈：
 * - Next.js 15 App Router
 * - React 19
 * - TypeScript
 * - Tailwind CSS
 * - Lucide React Icons
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react"

// Next.js 15 兼容的页面组件Props类型定义
interface RulesPageProps {
  params: Promise<Record<string, string>>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * 规则配置页面组件
 * 
 * @description 配置和管理自动化回复规则，提升客服效率
 * @param props - Next.js 15页面组件属性
 * @returns 规则配置页面JSX元素
 */
export default async function RulesPage(_props: RulesPageProps) {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">规则配置</h1>
          <p className="text-muted-foreground">
            配置和管理自动化回复规则，提升客服效率
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新建规则
        </Button>
      </div>

      {/* 规则统计 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              总规则数
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">
              +2 本周新增
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              启用规则
            </CardTitle>
            <ToggleRight className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              80% 启用率
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              今日触发
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">342</div>
            <p className="text-xs text-muted-foreground">
              +25% 较昨日
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              成功率
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">
              规则执行成功率
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 规则列表 */}
      <Card>
        <CardHeader>
          <CardTitle>自动化规则</CardTitle>
          <CardDescription>
            管理所有自动化回复和处理规则
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 规则项 */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">订单状态查询</h4>
                  <p className="text-sm text-muted-foreground">
                    关键词：订单、发货、物流 → 自动查询订单状态并回复
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      已启用
                    </span>
                    <span className="text-xs text-muted-foreground">
                      今日触发 45 次
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <ToggleRight className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="sm" variant="outline">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">产品价格咨询</h4>
                  <p className="text-sm text-muted-foreground">
                    关键词：价格、多少钱、费用 → 发送价格表和优惠信息
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      已启用
                    </span>
                    <span className="text-xs text-muted-foreground">
                      今日触发 78 次
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <ToggleRight className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="sm" variant="outline">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Shield className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">售后服务</h4>
                  <p className="text-sm text-muted-foreground">
                    关键词：退货、换货、维修 → 转接人工客服并发送售后流程
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                      已禁用
                    </span>
                    <span className="text-xs text-muted-foreground">
                      暂停使用
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <ToggleLeft className="h-4 w-4 text-gray-600" />
                </Button>
                <Button size="sm" variant="outline">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">营业时间提醒</h4>
                  <p className="text-sm text-muted-foreground">
                    非营业时间 → 自动回复营业时间和联系方式
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      已启用
                    </span>
                    <span className="text-xs text-muted-foreground">
                      今日触发 12 次
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <ToggleRight className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="sm" variant="outline">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <Button variant="outline">
              查看所有规则
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}