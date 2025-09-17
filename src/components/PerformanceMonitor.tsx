import { useEffect } from 'react';

interface PerformanceMonitorProps {
  onPerformanceData?: (data: {
    loadTime: number;
    renderTime: number;
    memoryUsage?: number;
  }) => void;
}

/**
 * 性能监控组件
 * 监控页面加载时间、渲染时间和内存使用情况
 */
const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ onPerformanceData }) => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // 监控页面加载性能
    const measurePagePerformance = () => {
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const loadTime = navigation.loadEventEnd - navigation.fetchStart;
        const renderTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;

        let memoryUsage;
        if ('memory' in performance) {
          const memory = (performance as Performance & {
            memory: {
              usedJSHeapSize: number;
              totalJSHeapSize: number;
              jsHeapSizeLimit: number;
            };
          }).memory;
          memoryUsage = {
            used: Math.round(memory.usedJSHeapSize / 1048576), // MB
            total: Math.round(memory.totalJSHeapSize / 1048576), // MB
            limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
          };
        }

        const performanceData = {
          loadTime: Math.round(loadTime),
          renderTime: Math.round(renderTime),
          memoryUsage: memoryUsage?.used,
        };

        console.log('🚀 性能数据:', {
          ...performanceData,
          ...(memoryUsage && { memory: memoryUsage }),
        });

        onPerformanceData?.(performanceData);
      }
    };

    // 监控长任务
    const observeLongTasks = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.duration > 50) {
                console.warn('⚠️ 检测到长任务:', {
                  name: entry.name,
                  duration: Math.round(entry.duration),
                  startTime: Math.round(entry.startTime),
                });
              }
            }
          });

          observer.observe({ entryTypes: ['longtask'] });

          return () => observer.disconnect();
        } catch (error) {
          console.warn('长任务监控不可用:', error);
        }
      }
    };

    // 页面加载完成后测量性能
    const timer = setTimeout(measurePagePerformance, 1000);

    // 开始监控长任务
    const cleanupLongTaskObserver = observeLongTasks();

    return () => {
      clearTimeout(timer);
      cleanupLongTaskObserver?.();
    };
  }, [onPerformanceData]);

  return null; // 这是一个纯逻辑组件，不渲染任何内容
};

export default PerformanceMonitor;
