export const calculateWorkerProductivity = (attendanceData, fromDate, toDate) => {
  // Convert date strings to Date objects for comparison
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  
  // Standard work times in minutes from midnight
  const WORK_START = 9 * 60; // 9:00 AM = 540 minutes
  const WORK_END = 19 * 60; // 7:00 PM = 1140 minutes
  const LUNCH_START = 13.5 * 60; // 1:30 PM = 750 minutes
  const LUNCH_END = 14.5 * 60; // 2:30 PM = 810 minutes
  const STANDARD_WORK_MINUTES = (WORK_END - WORK_START) - (LUNCH_END - LUNCH_START); // 9 hours - 1 hour lunch = 480 minutes
  
  let total_actual_working_minutes = 0;
  let total_permission_minutes = 0;
  
  // Helper function to convert time string to minutes from midnight
  const timeToMinutes = (timeStr) => {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes + (seconds / 60);
    
    if (period === 'PM' && hours !== 12) {
      totalMinutes += 12 * 60;
    } else if (period === 'AM' && hours === 12) {
      totalMinutes = minutes + (seconds / 60);
    }
    
    return Math.floor(totalMinutes);
  };
  
  // Helper function to check if a date is within the range
  const isDateInRange = (dateStr) => {
    const date = new Date(dateStr);
    return date >= startDate && date <= endDate;
  };
  
  // Group attendance data by date
  const attendanceByDate = {};
  
  attendanceData.forEach(record => {
    if (isDateInRange(record.date)) {
      const dateKey = record.date.split('T')[0];
      if (!attendanceByDate[dateKey]) {
        attendanceByDate[dateKey] = [];
      }
      attendanceByDate[dateKey].push({
        time: timeToMinutes(record.time),
        presence: record.presence,
        originalTime: record.time
      });
    }
  });
  
  // Process each day
  Object.keys(attendanceByDate).forEach(date => {
    const dayRecords = attendanceByDate[date].sort((a, b) => a.time - b.time);
    
    if (dayRecords.length === 0) return;
    
    let dayWorkingMinutes = 0;
    let dayPermissionMinutes = 0;
    let workStartTime = null;
    let workEndTime = null;
    let lunchOutTime = null;
    let lunchInTime = null;
    
    // Find punch times
    dayRecords.forEach(record => {
      if (record.presence) { // Punch in
        if (workStartTime === null) {
          workStartTime = record.time;
        } else if (lunchOutTime !== null && lunchInTime === null) {
          lunchInTime = record.time;
        }
      } else { // Punch out
        if (lunchOutTime === null && workStartTime !== null) {
          // This could be lunch out or end of day
          if (record.time >= LUNCH_START - 60 && record.time <= LUNCH_END + 60) {
            lunchOutTime = record.time;
          } else {
            workEndTime = record.time;
          }
        } else if (lunchOutTime !== null && lunchInTime !== null) {
          workEndTime = record.time;
        } else if (workStartTime !== null) {
          workEndTime = record.time;
        }
      }
    });
    
    // Calculate working hours and permissions
    if (workStartTime !== null) {
      // Morning entry calculation
      if (workStartTime > WORK_START) {
        // Late entry - permission time
        dayPermissionMinutes += Math.min(workStartTime - WORK_START, WORK_END - WORK_START);
      }
      
      // Calculate actual work start time (not before 9 AM)
      const actualWorkStart = Math.max(workStartTime, WORK_START);
      
      // Handle lunch calculations
      let lunchPermissionMinutes = 0;
      let actualLunchDuration = LUNCH_END - LUNCH_START; // Default 60 minutes
      
      if (lunchOutTime !== null) {
        // Early lunch departure
        if (lunchOutTime < LUNCH_START) {
          lunchPermissionMinutes += LUNCH_START - lunchOutTime;
        }
        
        if (lunchInTime !== null) {
          // Late lunch return
          if (lunchInTime > LUNCH_END) {
            lunchPermissionMinutes += lunchInTime - LUNCH_END;
          }
          
          // Calculate actual lunch duration
          const lunchStart = Math.max(lunchOutTime, LUNCH_START);
          const lunchEnd = Math.min(lunchInTime, LUNCH_END);
          
          if (lunchEnd > lunchStart) {
            actualLunchDuration = lunchInTime - lunchOutTime;
          }
        }
      }
      
      dayPermissionMinutes += lunchPermissionMinutes;
      
      // End of day calculation
      if (workEndTime !== null) {
        // Early departure - permission time
        if (workEndTime < WORK_END) {
          dayPermissionMinutes += WORK_END - workEndTime;
        }
        
        // Calculate actual work end time (not after 7 PM)
        const actualWorkEnd = Math.min(workEndTime, WORK_END);
        
        // Calculate total working minutes
        if (actualWorkEnd > actualWorkStart) {
          dayWorkingMinutes = actualWorkEnd - actualWorkStart;
          
          // Subtract lunch time if it falls within work hours
          if (lunchOutTime !== null && lunchInTime !== null) {
            const lunchStart = Math.max(lunchOutTime, actualWorkStart);
            const lunchEnd = Math.min(lunchInTime, actualWorkEnd);
            
            if (lunchEnd > lunchStart) {
              dayWorkingMinutes -= (lunchEnd - lunchStart);
            }
          } else {
            // Subtract standard lunch hour if no lunch punches
            const standardLunchStart = Math.max(LUNCH_START, actualWorkStart);
            const standardLunchEnd = Math.min(LUNCH_END, actualWorkEnd);
            
            if (standardLunchEnd > standardLunchStart) {
              dayWorkingMinutes -= (standardLunchEnd - standardLunchStart);
            }
          }
        }
      }
    }
    
    // Ensure working minutes don't exceed standard work hours
    dayWorkingMinutes = Math.max(0, Math.min(dayWorkingMinutes, STANDARD_WORK_MINUTES));
    
    // Add to totals
    total_actual_working_minutes += dayWorkingMinutes;
    total_permission_minutes += dayPermissionMinutes;
  });
  
  return {
    total_actual_working_minutes,
    total_permission_minutes
  };
};