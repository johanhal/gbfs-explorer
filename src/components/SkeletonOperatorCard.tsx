import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MapPin, ChevronDown } from 'lucide-react';

/**
 * Skeleton loading card that matches the structure of OperatorCard
 * Uses Material Design skeleton loading principles with shimmering placeholders
 */
const SkeletonOperatorCard: React.FC = () => {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="flex items-center justify-between">
          {/* Operator name skeleton */}
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          
          {/* Map button skeleton */}
          <div className="flex items-center space-x-1 text-sm text-gray-300">
            <MapPin className="h-4 w-4" />
            <span className="text-gray-400">Map</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {/* Total Fleet Column */}
          <div className="md:col-span-1 flex flex-col justify-center">
            {/* "Total Fleet" label */}
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-1"></div>
            
            {/* Large number placeholder */}
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
            
            {/* Availability breakdown placeholder */}
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
            
            {/* Feed updated timestamp placeholder */}
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 mr-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
            </div>
          </div>

          {/* System Details Column */}
          <div className="md:col-span-1">
            {/* "System Details" header */}
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
            
            {/* Type line */}
            <div className="flex items-center mb-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-10 mr-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
            
            {/* Form Factor line */}
            <div className="flex items-center mb-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mr-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-14"></div>
            </div>
            
            {/* Additional details (stations, etc.) */}
            <div className="flex items-center mb-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mr-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
            </div>
          </div>

          {/* Links Column */}
          <div className="md:col-span-1">
            {/* "Links" header */}
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-10 mb-2"></div>
            
            {/* Website link placeholder */}
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
            
            {/* Email placeholder */}
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SkeletonOperatorCard;
