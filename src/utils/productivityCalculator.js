export const calculateWorkerProductivity = (productivityParameters) => {
  const {
    attendanceData,
    fromDate,
    toDate,
    options = {}
  } = productivityParameters;

  // Extract options with defaults
  const {
    considerOvertime = false,
    deductSalary = true,
    permissionTimeMinutes = 15,
    salaryDeductionPerBreak = 10,
    batches = [],
    lunchFrom = '12:00',
    lunchTo = '13:00',
    intervals = [],
    fiteredBatch = 'Full Time'
  } = options;

  // Helper function to convert time string (HH:MM or HH:MM:SS) to minutes from midnight
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return hours * 60 + minutes + seconds / 60;
  };

  // Helper function to convert minutes to time string
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to parse attendance time (e.g., "9:52:18 AM")
  const parseAttendanceTime = (timeStr) => {
    if (!timeStr) return 0;
    
    const [time, period] = timeStr.split(' ');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    
    let totalMinutes = minutes + (seconds || 0) / 60;
    
    if (period === 'AM') {
      totalMinutes += (hours === 12 ? 0 : hours) * 60;
    } else if (period === 'PM') {
      totalMinutes += (hours === 12 ? 12 : hours + 12) * 60;
    } else {
      // 24-hour format
      totalMinutes += hours * 60;
    }
    
    return totalMinutes;
  };

  // Helper function to check if date is within range
  const isDateInRange = (date, fromDate, toDate) => {
    const checkDate = new Date(date);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    checkDate.setHours(0, 0, 0, 0);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return checkDate >= from && checkDate <= to;
  };

  // Check if it's a single day calculation
  const isSingleDay = new Date(fromDate).toDateString() === new Date(toDate).toDateString();

  // Get batch timings from filtered batch
  const selectedBatch = batches.find(batch => batch.batchName === fiteredBatch);
  const workStartTime = selectedBatch ? selectedBatch.from : '09:00';
  const workEndTime = selectedBatch ? selectedBatch.to : '19:00';

  // Convert times to minutes
  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const lunchStart = timeToMinutes(lunchFrom);
  const lunchEnd = timeToMinutes(lunchTo);

  // Calculate standard working minutes (excluding lunch and intervals)
  let standardWorkingMinutes = workEnd - workStart;
  standardWorkingMinutes -= (lunchEnd - lunchStart); // Subtract lunch time

  // Subtract interval times
  intervals.forEach(interval => {
    const intervalStart = timeToMinutes(interval.from);
    const intervalEnd = timeToMinutes(interval.to);
    standardWorkingMinutes -= (intervalEnd - intervalStart);
  });

  // Filter attendance data by date range
  const filteredData = attendanceData.filter(record => 
    isDateInRange(record.date, fromDate, toDate)
  );

  if (filteredData.length === 0) {
    return {
      totalDays: 0,
      workingDays: 0,
      totalWorkingHours: 0,
      averageWorkingHours: 0,
      totalPermissionTime: 0,
      totalSalaryDeduction: 0,
      productivityPercentage: 0,
      dailyBreakdown: [],
      summary: {
        punctualityScore: 0,
        attendanceRate: 0,
        finalSalary: 0,
        originalSalary: 0,
        worker: {
          name: '',
          username: '',
          rfid: '',
          department: '',
          email: '',
          perDaySalary: 0
        }
      },
      configuration: {
        considerOvertime,
        deductSalary,
        workStartTime,
        workEndTime,
        lunchStartTime: lunchFrom,
        lunchEndTime: lunchTo,
        permissionTimeMinutes,
        salaryDeductionPerBreak
      }
    };
  }

  // Get worker details from first record
  const worker = filteredData[0].worker || {};
  const perDaySalary = worker.perDaySalary || 0;
  const originalSalary = worker.salary || perDaySalary * 30; // Assuming 30 days if salary not provided

  let totalWorkingMinutes = 0;
  let totalPermissionMinutes = 0;
  let totalSalaryDeduction = 0;
  let dailyBreakdown = [];
  let punctualityViolations = 0;

  if (isSingleDay) {
    // Single day calculation - find the earliest and latest punch times
    const dayPunches = filteredData.map(record => ({
      time: parseAttendanceTime(record.time),
      originalTime: record.time,
      record
    })).sort((a, b) => a.time - b.time);

    if (dayPunches.length === 0) {
      return {
        totalDays: 0,
        workingDays: 0,
        totalWorkingHours: 0,
        averageWorkingHours: 0,
        totalPermissionTime: 0,
        totalSalaryDeduction: 0,
        productivityPercentage: 0,
        dailyBreakdown: [],
        summary: {
          punctualityScore: 0,
          attendanceRate: 0,
          finalSalary: originalSalary,
          originalSalary,
          worker: {
            name: worker.name || '',
            username: worker.username || '',
            rfid: worker.rfid || '',
            department: worker.department || '',
            email: worker.email || '',
            perDaySalary: worker.perDaySalary || 0
          }
        },
        configuration: {
          considerOvertime,
          deductSalary,
          workStartTime,
          workEndTime,
          lunchStartTime: lunchFrom,
          lunchEndTime: lunchTo,
          permissionTimeMinutes,
          salaryDeductionPerBreak
        }
      };
    }

    const firstPunch = dayPunches[0];
    const lastPunch = dayPunches[dayPunches.length - 1];
    
    const dayData = {
      date: firstPunch.record.date,
      punchTime: `${firstPunch.originalTime} - ${lastPunch.originalTime}`,
      workingMinutes: 0,
      permissionMinutes: 0,
      salaryDeduction: 0,
      issues: []
    };

    let effectiveWorkStart = Math.max(firstPunch.time, workStart);
    let effectiveWorkEnd = Math.min(lastPunch.time, workEnd);
    let permissionTime = 0;
    let daySalaryDeduction = 0;

    // Handle late arrival
    if (firstPunch.time > workStart) {
      const lateMinutes = firstPunch.time - workStart;
      if (lateMinutes <= permissionTimeMinutes) {
        permissionTime += lateMinutes;
        dayData.issues.push(`Late arrival: ${Math.round(lateMinutes)} minutes (within permission)`);
      } else {
        permissionTime += permissionTimeMinutes;
        const excessLateMinutes = lateMinutes - permissionTimeMinutes;
        if (deductSalary && perDaySalary > 0) {
          daySalaryDeduction += Math.ceil(excessLateMinutes / permissionTimeMinutes) * salaryDeductionPerBreak;
          dayData.issues.push(`Excessive late arrival: ${Math.round(excessLateMinutes)} minutes beyond permission`);
        }
        punctualityViolations++;
      }
    }

    // Handle early departure
    if (lastPunch.time < workEnd) {
      const earlyMinutes = workEnd - lastPunch.time;
      if (earlyMinutes > permissionTimeMinutes) {
        const excessEarlyMinutes = earlyMinutes - permissionTimeMinutes;
        if (deductSalary && perDaySalary > 0) {
          daySalaryDeduction += Math.ceil(excessEarlyMinutes / permissionTimeMinutes) * salaryDeductionPerBreak;
          dayData.issues.push(`Early departure: ${Math.round(excessEarlyMinutes)} minutes beyond permission`);
        }
      }
    }

    // Calculate working minutes
    let dayWorkingMinutes = 0;
    if (effectiveWorkEnd > effectiveWorkStart) {
      dayWorkingMinutes = effectiveWorkEnd - effectiveWorkStart;

      // Subtract lunch time if it falls within working hours
      if (effectiveWorkStart < lunchEnd && effectiveWorkEnd > lunchStart) {
        const lunchOverlap = Math.min(effectiveWorkEnd, lunchEnd) - Math.max(effectiveWorkStart, lunchStart);
        dayWorkingMinutes -= Math.max(0, lunchOverlap);
      }

      // Subtract interval times if they fall within working hours
      intervals.forEach(interval => {
        const intervalStart = timeToMinutes(interval.from);
        const intervalEnd = timeToMinutes(interval.to);
        if (effectiveWorkStart < intervalEnd && effectiveWorkEnd > intervalStart) {
          const intervalOverlap = Math.min(effectiveWorkEnd, intervalEnd) - Math.max(effectiveWorkStart, intervalStart);
          dayWorkingMinutes -= Math.max(0, intervalOverlap);
        }
      });
    }

    dayData.workingMinutes = Math.max(0, dayWorkingMinutes);
    dayData.permissionMinutes = permissionTime;
    dayData.salaryDeduction = daySalaryDeduction;

    totalWorkingMinutes = dayData.workingMinutes;
    totalPermissionMinutes = permissionTime;
    totalSalaryDeduction = daySalaryDeduction;
    dailyBreakdown.push(dayData);

  } else {
    // Multiple days calculation - group by date
    const groupedByDate = {};
    filteredData.forEach(record => {
      const dateKey = new Date(record.date).toDateString();
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(record);
    });

    Object.keys(groupedByDate).forEach(dateKey => {
      const dayRecords = groupedByDate[dateKey];
      const dayPunches = dayRecords.map(record => ({
        time: parseAttendanceTime(record.time),
        originalTime: record.time,
        record
      })).sort((a, b) => a.time - b.time);

      if (dayPunches.length === 0) return;

      const firstPunch = dayPunches[0];
      const lastPunch = dayPunches[dayPunches.length - 1];
      
      const dayData = {
        date: firstPunch.record.date,
        punchTime: dayPunches.length === 1 ? firstPunch.originalTime : `${firstPunch.originalTime} - ${lastPunch.originalTime}`,
        workingMinutes: 0,
        permissionMinutes: 0,
        salaryDeduction: 0,
        issues: []
      };

      let effectiveWorkStart = Math.max(firstPunch.time, workStart);
      let effectiveWorkEnd = dayPunches.length > 1 ? Math.min(lastPunch.time, workEnd) : workEnd;
      let permissionTime = 0;
      let daySalaryDeduction = 0;

      // Handle late arrival
      if (firstPunch.time > workStart) {
        const lateMinutes = firstPunch.time - workStart;
        if (lateMinutes <= permissionTimeMinutes) {
          permissionTime += lateMinutes;
          dayData.issues.push(`Late arrival: ${Math.round(lateMinutes)} minutes (within permission)`);
        } else {
          permissionTime += permissionTimeMinutes;
          const excessLateMinutes = lateMinutes - permissionTimeMinutes;
          if (deductSalary && perDaySalary > 0) {
            daySalaryDeduction += Math.ceil(excessLateMinutes / permissionTimeMinutes) * salaryDeductionPerBreak;
            dayData.issues.push(`Excessive late arrival: ${Math.round(excessLateMinutes)} minutes beyond permission`);
          }
          punctualityViolations++;
        }
      }

      // Calculate working minutes
      let dayWorkingMinutes = 0;
      if (effectiveWorkEnd > effectiveWorkStart) {
        if (dayPunches.length === 1) {
          // Single punch - assume worked till end time
          dayWorkingMinutes = effectiveWorkEnd - effectiveWorkStart;
        } else {
          // Multiple punches - use actual time difference
          dayWorkingMinutes = effectiveWorkEnd - effectiveWorkStart;
        }

        // Subtract lunch time if it falls within working hours
        if (effectiveWorkStart < lunchEnd && effectiveWorkEnd > lunchStart) {
          const lunchOverlap = Math.min(effectiveWorkEnd, lunchEnd) - Math.max(effectiveWorkStart, lunchStart);
          dayWorkingMinutes -= Math.max(0, lunchOverlap);
        }

        // Subtract interval times if they fall within working hours
        intervals.forEach(interval => {
          const intervalStart = timeToMinutes(interval.from);
          const intervalEnd = timeToMinutes(interval.to);
          if (effectiveWorkStart < intervalEnd && effectiveWorkEnd > intervalStart) {
            const intervalOverlap = Math.min(effectiveWorkEnd, intervalEnd) - Math.max(effectiveWorkStart, intervalStart);
            dayWorkingMinutes -= Math.max(0, intervalOverlap);
          }
        });
      }

      dayData.workingMinutes = Math.max(0, dayWorkingMinutes);
      dayData.permissionMinutes = permissionTime;
      dayData.salaryDeduction = daySalaryDeduction;

      totalWorkingMinutes += dayData.workingMinutes;
      totalPermissionMinutes += permissionTime;
      totalSalaryDeduction += daySalaryDeduction;
      dailyBreakdown.push(dayData);
    });
  }

  // Calculate productivity metrics
  const totalDays = isSingleDay ? 1 : Object.keys(dailyBreakdown.reduce((acc, day) => {
    const dateKey = new Date(day.date).toDateString();
    acc[dateKey] = true;
    return acc;
  }, {})).length;

  const expectedTotalMinutes = totalDays * standardWorkingMinutes;
  const productivityPercentage = expectedTotalMinutes > 0 ? (totalWorkingMinutes / expectedTotalMinutes) * 100 : 0;
  const averageWorkingHours = totalDays > 0 ? (totalWorkingMinutes / totalDays) / 60 : 0;
  const punctualityScore = totalDays > 0 ? ((totalDays - punctualityViolations) / totalDays) * 100 : 0;
  const attendanceRate = 100; // Since we're only looking at days they were present

  // Calculate final salary after deductions
  let finalSalary = originalSalary;
  if (deductSalary) {
    finalSalary = Math.max(0, originalSalary - totalSalaryDeduction);
  }

  return {
    totalDays,
    workingDays: totalDays,
    totalWorkingHours: totalWorkingMinutes / 60,
    averageWorkingHours,
    totalPermissionTime: totalPermissionMinutes,
    totalSalaryDeduction,
    productivityPercentage: Math.round(productivityPercentage * 100) / 100,
    dailyBreakdown: dailyBreakdown.map(day => ({
      ...day,
      workingHours: day.workingMinutes / 60,
      permissionTime: day.permissionMinutes,
      workingTimeDisplay: minutesToTime(day.workingMinutes),
      permissionTimeDisplay: minutesToTime(day.permissionMinutes)
    })),
    summary: {
      punctualityScore: Math.round(punctualityScore * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      finalSalary,
      originalSalary,
      worker: {
        name: worker.name || '',
        username: worker.username || '',
        rfid: worker.rfid || '',
        department: worker.department || '',
        email: worker.email || '',
        perDaySalary: worker.perDaySalary || 0
      }
    },
    configuration: {
      considerOvertime,
      deductSalary,
      workStartTime,
      workEndTime,
      lunchStartTime: lunchFrom,
      lunchEndTime: lunchTo,
      permissionTimeMinutes,
      salaryDeductionPerBreak
    }
  };
};