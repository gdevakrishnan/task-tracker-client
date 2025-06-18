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

const Dashboard = () => {
  const { subdomain } = useContext(appContext);
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();
  console.log(user);
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [columns, setColumns] = useState([]);

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
      {user?.username && user?.subdomain && typeof user.salary === 'number' && typeof user.finalSalary === 'number' ? (
        <Card title="Greetings!" className="mb-6">
          <p>
            Hi {user.username}! Welcome to <strong>{user.subdomain}</strong>. <br />
            Your base monthly salary is <strong>Rs.{user.salary.toFixed(2)}</strong>, and thanks to your efforts this month, your final salary is <strong>Rs.{user.finalSalary.toFixed(2)}</strong>.
          </p>
        </Card>
      ) : user?.username ? (
        <Card title="Greetings!" className="mb-6">
          <p>
            Hi {user.username}! Welcome aboard.
          </p>
        </Card>
      ) : null}


      {
        Array.isArray(notifications) && notifications.length > 0 && (
          <Card title="Latest Notification" className="mb-6">
            <p>
              {notifications[0]?.messageData || "No notifications found"}
            </p>
          </Card>
        )
      }

      <CustomTaskForm />
      <h1 className="text-2xl font-bold mb-6">Employee Dashboard</h1>

      <Card className="mb-6">
        <TaskForm
          topics={topics}
          columns={columns}
          onTaskSubmit={handleTaskSubmit}
        />
      </Card>

      <Card title="Your Recent Activity">
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