import { useState, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { getMyTasks } from '../../services/taskService';
import { getTopics } from '../../services/topicService';
import { getColumns } from '../../services/columnService';
import TaskForm from './TaskForm';
import Scoreboard from './Scoreboard';
import Card from '../common/Card';
import Spinner from '../common/Spinner';
import CustomTaskForm from './CustomTaskForm';
import { readNotification } from '../../services/notificationService';
import appContext from '../../context/AppContext';
import { FaMoneyBillAlt } from 'react-icons/fa';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';

const Dashboard = () => {
  const { subdomain } = useContext(appContext);
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();
  console.log(user);
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [columns, setColumns] = useState([]);

  // prepare breakdown for tooltip
  const baseSalary = typeof user?.salary === 'number' ? user.salary : 0;
  const finalSalary = typeof user?.finalSalary === 'number' ? user.finalSalary : 0;
  const diff = finalSalary - baseSalary;
  const allowances = diff > 0 ? diff : 0;
  const deductions = diff < 0 ? -diff : 0;

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await readNotification(subdomain);
      console.log(data.notifications);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err) {
      toast.error('Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const [tasksData, topicsData, columnsData] = await Promise.all([
          getMyTasks(),
          getTopics({ subdomain: user.subdomain }),
          getColumns({ subdomain: user.subdomain })
        ]);

        setTasks(tasksData);

        // Filter topics for the worker's department
        const filteredTopics = topicsData.filter(topic =>
          topic.department === 'all' || topic.department === user.department
        );
        setTopics(filteredTopics);

        // Filter columns for the worker's department
        const filteredColumns = columnsData.filter(column =>
          column.department === 'all' || column.department === user.department
        );
        setColumns(filteredColumns);
      } catch (error) {
        toast.error('Failed to load dashboard data');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const handleTaskSubmit = (newTask) => {
    setTasks(prev => [newTask, ...prev]);
    toast.success('Task submitted successfully!');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
     <div>
      <div
        className="mb-6 rounded-lg p-6 shadow-lg bg-gradient-to-r from-black to-black"
      >
        <motion.h2
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, duration:0.5 }}
          className="text-xl font-bold mb-5 text-gradient-animate"
        >
          Welcome, {user?.username}!
        </motion.h2>
        <p className="mb-4 text-white">
          Your workspace at{' '}
          <motion.span
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, duration: 0.5 }}
            className="text-xl font-bold text-gradient-animate-green"
          >
            {user?.subdomain}
          </motion.span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base Salary with Icon */}
          <div className="bg-black p-4 rounded-lg flex items-center space-x-4">
          <div className="bg-yellow-500/20 p-3 rounded-full">
                        <FaMoneyBillAlt className="h-6 w-6 text-blue-300" />
            </div>
            <div>
             <p className="text-sm text-blue-200">Base Monthly Salary</p>
             {baseSalary > 0 ? (
                <CountUp
                  start={0}
                  end={baseSalary}
                  duration={1}
                  prefix="₹"
                  decimals={2}
                  className="text-2xl font-bold text-white"
                />
              ) : (
                <p className="text-2xl font-bold text-white">N/A</p>
              )}
            </div>
          </div>
          {/* Final Monthly Salary with Icon */}
          <div className="bg-black p-4 rounded-lg flex items-center space-x-4">
          <div className="bg-green-500/20 p-3 rounded-full">
                      <FaMoneyBillAlt className="h-6 w-6 text-yellow-300" />
            </div>
            <div>
             <p className="text-sm text-blue-200">Final Monthly Salary</p>
             {finalSalary > 0 ? (
                <div
                  title={
                    `Base: ₹${baseSalary.toFixed(2)} | ` +
                    `Allowances: ₹${allowances.toFixed(2)} | ` +
                    `Deductions: ₹${deductions.toFixed(2)}`
                  }
                >
                  <CountUp
                    start={0}
                    end={finalSalary}
                    duration={1}
                    prefix="₹"
                    decimals={2}
                    className="text-2xl font-bold text-white"
                  />
                </div>
              ) : (
                <p className="text-2xl font-bold text-white">N/A</p>
              )}
            </div>
          </div>
        </div>
      </div> 


      {
        Array.isArray(notifications) && notifications.length > 0 && (
          <Card
              title={
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Latest Notification
                </div>
              }
              className="mb-6"
            >
              <p>
                {notifications[0]?.messageData || "No notifications found."}
              </p>
          </Card>
        )
      }


      <Card className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Submit Custom Task
        </h2>
        <CustomTaskForm />
      </Card>
      
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Employee Dashboard
      </h1>

      <Card className="mb-6">
        <TaskForm
          topics={topics}
          columns={columns}
          onTaskSubmit={handleTaskSubmit}
        />
      </Card>

      <Card
        title={
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Your Recent Activity
          </div>
        }
      >
        {tasks.length === 0 ? (
          <p className="text-gray-500 py-4 text-center">
            No task submissions yet. Use the form above to submit your first task!
          </p>
        ) : (
          <div className="space-y-4">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task._id}
                className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      Submitted task: {task.points} points
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(task.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded-full">
                    +{task.points}
                  </div>
                </div>

                {task.topics && task.topics.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Topics:</p>
                    <div className="flex flex-wrap gap-1">
                      {task.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {topic.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6">
        <Scoreboard department={user.department} />
      </div>
    </div>
  );
};

export default Dashboard;